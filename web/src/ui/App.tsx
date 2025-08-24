import React, { useEffect, useMemo, useRef, useState } from 'react';
import { playTrackId, transferPlaybackToPlayer, subscribeToPlayerState, getThisDevice, togglePlay, setVolume, getVolume } from '../spotify/player';
import QRCode from 'qrcode';

export function App() {
  const [group, setGroup] = useState('');
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; role: 'host' | 'player'; name: string; avatar?: string }> | null>(null);
  const [state, setState] = useState<any>(null);
  const [answer, setAnswer] = useState<null | { title: string; artist: string; year: number }>(null);
  const [judgement, setJudgement] = useState({ titleOk: false, artistOk: false, yearOk: false });
  const [lastPoints, setLastPoints] = useState<number | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [navError, setNavError] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<{ name: string; is_active: boolean } | null>(null);
  const [sdkState, setSdkState] = useState<any>(null);
  const [volume, setVol] = useState<number>(80);
  const [view, setView] = useState<'landing' | 'lobby'>('landing');
  const [joinCode, setJoinCode] = useState('');
  const [qrVisible, setQrVisible] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);
  const isHost = React.useMemo(() => me?.role === 'host', [me]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  function formatDuration(ms?: number) {
    if (!ms && ms !== 0) return '—';
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  async function fetchPlayableStart() {
    const seed = Date.now();
    setNavError(null);
    const r = await fetch(`/api/game/${encodeURIComponent(group)}/start?seed=${seed}`, { method: 'POST', credentials: 'include' });
    if (!r.ok) {
      setNavError(await r.text());
      return;
    }
    const data = await r.json();
    setState(data);
  }
  async function fetchPlayableNext() {
    setNavError(null);
    const rn = await fetch(`/api/game/${encodeURIComponent(group)}/next`, { method: 'POST', credentials: 'include' });
    if (!rn.ok) {
      setNavError(await rn.text());
      return;
    }
    const data = await rn.json();
    setState(data);
  }
  async function fetchPlayablePrev() {
    setNavError(null);
    const rp = await fetch(`/api/game/${encodeURIComponent(group)}/prev`, { method: 'POST', credentials: 'include' });
    if (!rp.ok) {
      setNavError(await rp.text());
      return;
    }
    const data = await rp.json();
    setState(data);
  }

  // Auto-play when we receive a new preview URL (user gesture: button click triggers fetch)
  useEffect(() => {
    const id = state?.track?.id as string | undefined;
    if (id) {
      // Trigger full-track playback via Spotify SDK
      playTrackId(id).catch((e) => console.warn('Playback failed', e));
    }
  }, [state?.track?.id]);

  // Subscribe to SDK state and poll device info
  useEffect(() => {
    const unsub = subscribeToPlayerState((s) => setSdkState(s));
    let t: any;
    async function poll() {
      try {
        const info = await getThisDevice();
        if (info) setDeviceInfo({ name: info.name, is_active: info.is_active });
      } catch {}
      t = setTimeout(poll, 5000);
    }
    poll();
    // Initialize volume
    getVolume().then((v) => setVol(Math.round(v * 100))).catch(() => {});
    return () => {
      unsub();
      if (t) clearTimeout(t);
    };
  }, []);

  // On load: detect auth redirect and/or existing session
  useEffect(() => {
    const url = new URL(window.location.href);
    const authed = url.searchParams.get('authed');
    const groupParam = url.searchParams.get('group');
    const autojoin = url.searchParams.get('autojoin') === '1';
    const connect = url.searchParams.get('connect') === '1';
    if (groupParam) {
      setGroup(groupParam);
      setView('lobby');
    }

    async function checkMe() {
      try {
        const r = await fetch('/api/me', { credentials: 'include' });
        if (r.ok) {
          const data = await r.json();
          setMe(data);
          if (!group && data.group) {
            setGroup(data.group);
            setView('lobby');
          }
        }
      } catch {}
    }

    async function maybeAutoJoin() {
      try {
        if (autojoin && (groupParam || group)) {
          const grp = groupParam || group;
          const rj = await fetch('/api/lobby/join', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group: grp }), credentials: 'include'
          });
          await rj.json();
        }
      } catch {}
    }

    if (authed === '1') {
      checkMe().then(maybeAutoJoin).then(checkMe);
      // Clean URL params after handling
      url.searchParams.delete('authed');
      url.searchParams.delete('group');
      url.searchParams.delete('autojoin');
      url.searchParams.delete('connect');
      const search = url.searchParams.toString();
      window.history.replaceState({}, '', url.pathname + (search ? `?${search}` : ''));
    } else {
      // Also try to detect existing session silently
      checkMe();
      // If instructed to connect, redirect to Spotify login carrying group & return params
      if (connect) {
        const stateVal = (groupParam || group) ? `group:${encodeURIComponent(groupParam || group)}` : 'mm';
        window.location.href = `/auth/login?state=${stateVal}`;
      }
    }
  }, []);

  // Poll lobby members so everyone can see who is in the game
  useEffect(() => {
    if (!group) return;
    let iv: any;
    const fetchMembers = async () => {
      try {
        const r = await fetch(`/api/lobby/${encodeURIComponent(group)}`);
        if (r.ok) {
          const data = await r.json();
          setMembers(data.members || null);
        }
      } catch {}
    };
    fetchMembers();
    iv = setInterval(fetchMembers, 5000);
    return () => iv && clearInterval(iv);
  }, [group]);

  function randomGroup() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let s = '';
    for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  function isValidGroupName(s: string) {
    return /^[A-Za-z0-9]{12}$/.test(s);
  }

  const loginUrl = useMemo(() => {
    const state = group ? `group:${encodeURIComponent(group)}` : 'mm';
    return `/auth/login?state=${state}`;
  }, [group]);

  // Build shareable link and QR when in lobby with a group
  useEffect(() => {
    if (!group || view !== 'lobby') return;
    const origin = window.location.origin; // Use current host/port
    const link = `${origin}/game?group=${encodeURIComponent(group)}&autojoin=1&connect=1`;
    setShareLink(link);
    if (qrVisible) {
      QRCode.toDataURL(link, { width: 256, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
    }
  }, [group, view, qrVisible]);

  if (view === 'landing') {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 720 }}>
        <h1>Musica Maestro</h1>
        <p>
          A party game powered by Spotify: create a shared playlist from everyone’s tastes,
          play songs, and score points by identifying the Title (+1), Artist (+1), and Year (+5).
          The host needs Spotify Premium to play full tracks in the browser; other players do not.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <button onClick={() => {
            const code = randomGroup();
            setGroup(code);
            setView('lobby');
          }}>Create New Game</button>
          <div>
            <input
              placeholder="Enter 12-char group code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={12}
              style={{ marginRight: 8 }}
            />
            <button onClick={() => {
              if (isValidGroupName(joinCode)) {
                setGroup(joinCode);
                setView('lobby');
              } else {
                alert('Group names must be 12 alphanumeric characters.');
              }
            }}>Join Existing Game</button>
          </div>
        </div>
        <div style={{ marginTop: 16, color: '#555', fontSize: 14 }}>
          Tip: Share the 12-character group code with friends so they can join.
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 720 }}>
      <h1>Musica Maestro</h1>
      <p>Group: <strong>{group}</strong>. Host needs Premium; others don’t.</p>
      <section style={{ marginTop: 8, color: '#555' }}>
        Share this code with your friends to join: <code style={{ fontWeight: 700 }}>{group}</code>
        <button title="Copy group code" style={{ marginLeft: 8 }} onClick={async () => {
          await navigator.clipboard.writeText(group);
          setToast('Group code copied');
          setTimeout(() => setToast(null), 2000);
        }}>Copy</button>
      </section>
      <section style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button title="Toggle QR code" onClick={() => setQrVisible((v) => !v)}>{qrVisible ? 'Hide QR' : 'Show QR'}</button>
          <input readOnly value={shareLink} style={{ width: 360 }} />
          <button title="Copy join link" onClick={async () => {
            await navigator.clipboard.writeText(shareLink);
            setToast('Join link copied');
            setTimeout(() => setToast(null), 2000);
          }}>Copy Link</button>
        </div>
        {qrVisible && (
          <div style={{ marginTop: 8 }}>
            {qrDataUrl ? <img src={qrDataUrl} alt="Join QR" width={256} height={256} /> : <span>Generating QR…</span>}
            {window.location.hostname === '127.0.0.1' && (
              <div style={{ marginTop: 8, color: '#a00' }}>
                Note: 127.0.0.1 works only on this device. For others on your network, set WEB_URL and open the app using your LAN IP.
              </div>
            )}
          </div>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <a href={loginUrl}>
          <button>{me ? 'Reconnect Spotify' : 'Connect with Spotify'}</button>
        </a>
        <button style={{ marginLeft: 12 }} onClick={() => setView('landing')}>Back to Landing</button>
      </section>

      <section style={{ marginTop: 12, color: me ? '#0a7d2b' : '#a00' }}>
        {me ? (
          <span>Connected as <strong>{me.name}</strong> ({me.id})</span>
        ) : (
          <span>Not connected to Spotify</span>
        )}
      </section>

      {me && (
        <section style={{ marginTop: 12, padding: 8, border: '1px solid #eee', borderRadius: 8 }}>
          <strong>{me.name}</strong> — <span style={{ opacity: 0.8 }}>{me.role === 'host' ? 'Host' : 'Player'}</span>
        </section>
      )}

      <section style={{ marginTop: 24 }}>
        <button disabled={!me || !group.trim() || !/^[A-Za-z0-9]{12}$/.test(group)} onClick={async () => {
          const r = await fetch('/api/lobby/join', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group })
          });
          const data = await r.json();
          setMembers(data.members || null);
          try {
            const rm = await fetch('/api/me', { credentials: 'include' });
            if (rm.ok) setMe(await rm.json());
          } catch {}
        }}>Join lobby</button>
      </section>

      {members && (
        <section style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 6 }}><strong>Members in {group}:</strong></div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {members.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', border: '1px solid #eee', borderRadius: 16 }}>
                {m.avatar ? (
                  <img src={m.avatar} alt={m.name} width={24} height={24} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', background: '#ddd',
                    color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700
                  }}>
                    {m.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <span>{m.name}</span>
                <span style={{
                  background: m.role === 'host' ? '#1db954' : '#666',
                  color: m.role === 'host' ? '#000' : '#fff',
                  borderRadius: 10,
                  padding: '2px 6px',
                  fontSize: 12
                }}>
                  {m.role === 'host' ? 'Host' : 'Player'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', right: 16, bottom: 72,
          background: '#333', color: '#fff', padding: '8px 12px',
          borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          {toast}
        </div>
      )}

      {isHost && (
        <section style={{ marginTop: 24 }}>
          <button disabled={!me || !group.trim()} onClick={async () => {
            try { await transferPlaybackToPlayer(); } catch {}
            setAnswer(null);
            setJudgement({ titleOk: false, artistOk: false, yearOk: false });
            setLastPoints(null);
            setRevealError(null);
            await fetchPlayableStart();
            try {
              const rm = await fetch('/api/me', { credentials: 'include' });
              if (rm.ok) setMe(await rm.json());
            } catch {}
          }}>Start game</button>
          <button style={{ marginLeft: 12 }} disabled={!me || !group.trim()} onClick={async () => {
            const r = await fetch(`/api/game/${encodeURIComponent(group)}/state`);
            setState(await r.json());
          }}>Refresh state</button>
          <button style={{ marginLeft: 12 }} disabled={!me || !group.trim()} onClick={async () => {
            try { await transferPlaybackToPlayer(); } catch {}
            setAnswer(null);
            setJudgement({ titleOk: false, artistOk: false, yearOk: false });
            setLastPoints(null);
            setRevealError(null);
            await fetchPlayableNext();
          }}>Next track</button>
        </section>
      )}

      {isHost && (
      <section style={{ marginTop: 12 }}>
        <audio ref={audioRef} controls style={{ display: 'none' }} />
        <div style={{ marginTop: 8, fontSize: 12, color: '#555' }}>
          Playing via Spotify Web Playback SDK (requires Premium)
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: deviceInfo?.is_active ? '#1db954' : '#a00' }}>
          Device: {deviceInfo?.name || 'Web Player'} — {deviceInfo?.is_active ? 'active' : 'inactive'}
          <button style={{ marginLeft: 8 }} onClick={() => transferPlaybackToPlayer()}>Make active here</button>
        </div>
        {state?.index !== undefined && state?.total !== undefined && (
          <div style={{ marginTop: 4, fontSize: 12, color: '#555' }}>
            Track {state.index + 1} of {state.total}
          </div>
        )}
        {navError && (
          <div style={{ marginTop: 8, color: '#a00' }}>{navError}</div>
        )}
      </section>
      )}

      {/* Mini player bar */}
      {isHost && (
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        background: '#111', color: '#fff',
        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12
      }}>
        <button onClick={() => fetchPlayablePrev().then(() => transferPlaybackToPlayer()).catch(() => {})} style={{ background: '#222', color: '#fff', border: 0, padding: '6px 10px', borderRadius: 4 }}>
          ⏮
        </button>
        <button onClick={() => togglePlay()} style={{ background: '#1db954', color: '#000', border: 0, padding: '6px 10px', borderRadius: 4 }}>
          {sdkState?.paused ? 'Play' : 'Pause'}
        </button>
        <button onClick={() => fetchPlayableNext().then(() => transferPlaybackToPlayer()).catch(() => {})} style={{ background: '#222', color: '#fff', border: 0, padding: '6px 10px', borderRadius: 4 }}>
          ⏭
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Vol</span>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={async (e) => {
              const v = Number(e.target.value);
              setVol(v);
              await setVolume(v / 100);
            }}
          />
        </div>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          <span>{sdkState ? 'Now Playing' : 'Ready'}</span>
        </div>
        <div style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatDuration(sdkState?.position || 0)} / {formatDuration(sdkState?.duration || state?.track?.duration_ms)}
        </div>
      </div>
      )}

      {isHost && (
      <section style={{ marginTop: 24 }}>
        <h3>Reveal & judge</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button disabled={!me || !group.trim() || !state?.track?.id} onClick={async () => {
            setRevealError(null);
            try {
              const r = await fetch(`/api/game/${encodeURIComponent(group)}/reveal`, { credentials: 'include' });
              if (!r.ok) {
                const t = await r.text();
                setRevealError(t);
                return;
              }
              const data = await r.json();
              if (data?.answer) setAnswer(data.answer);
            } catch (e) {
              setRevealError((e as Error).message);
            }
          }}>Reveal answer</button>

          <label><input type="checkbox" checked={judgement.titleOk} onChange={(e) => setJudgement({ ...judgement, titleOk: e.target.checked })} /> Title correct (+1)</label>
          <label><input type="checkbox" checked={judgement.artistOk} onChange={(e) => setJudgement({ ...judgement, artistOk: e.target.checked })} /> Artist correct (+1)</label>
          <label><input type="checkbox" checked={judgement.yearOk} onChange={(e) => setJudgement({ ...judgement, yearOk: e.target.checked })} /> Year correct (+5)</label>

          <button onClick={async () => {
            const r = await fetch(`/api/game/${encodeURIComponent(group)}/judge`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(judgement),
              credentials: 'include'
            });
            const data = await r.json();
            if (data?.points !== undefined) setLastPoints(data.points);
          }} disabled={!me || !group.trim()}>Submit result</button>
        </div>
        {answer && (
          <div style={{
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: 12,
            border: '1px solid #e5e5e5',
            borderRadius: 8,
            background: '#0a0a0a',
            color: '#fff'
          }}>
            <img
              src={state?.track?.album?.images?.[0]?.url || state?.track?.album?.images?.[1]?.url}
              alt={answer.title}
              style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 4 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{answer.title}</div>
              <div style={{ opacity: 0.85, marginTop: 2 }}>{answer.artist}</div>
              <div style={{ opacity: 0.7, marginTop: 2 }}>Album: {state?.track?.album?.name || '—'}</div>
              <div style={{ opacity: 0.7, marginTop: 2 }}>Year: {answer.year} · Duration: {formatDuration(state?.track?.duration_ms)}</div>
              {state?.track?.id && (
                <a
                  href={`https://open.spotify.com/track/${state.track.id}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ marginTop: 8, color: '#1db954', textDecoration: 'none', fontWeight: 600 }}
                >
                  Open in Spotify
                </a>
              )}
            </div>
          </div>
        )}
        {revealError && (
          <div style={{ marginTop: 8, color: '#a00' }}>
            {revealError}
          </div>
        )}
        {lastPoints !== null && (
          <div style={{ marginTop: 8 }}>
            Awarded: <strong>{lastPoints}</strong> point{lastPoints === 1 ? '' : 's'}
          </div>
        )}
      </section>
      )}

      <section style={{ marginTop: 24 }}>
        <h3>Try scoring API</h3>
        <pre style={{ background: '#f6f6f6', padding: 12 }}>
{`POST /api/score
{
  "guess": { "title": "...", "artist": "...", "year": 2019 },
  "actual": { "title": "...", "artist": "...", "year": 2019 }
}`}
        </pre>
      </section>
    </div>
  );
}
