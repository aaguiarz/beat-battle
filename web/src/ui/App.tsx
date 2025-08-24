import React, { useEffect, useMemo, useRef, useState } from 'react';
import { playTrackId, transferPlaybackToPlayer, subscribeToPlayerState, getThisDevice, togglePlay, setVolume, getVolume } from '../spotify/player';
import QRCode from 'qrcode';
import { Landing } from './Landing';

export function App() {
  const [group, setGroup] = useState('');
  const [me, setMe] = useState<{ id: string; name: string; role?: 'host' | 'player' } | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; role: 'host' | 'player'; name: string; avatar?: string }> | null>(null);
  const [state, setState] = useState<any>(null);
  const [answer, setAnswer] = useState<null | {
    title: string;
    artist: string;
    year: number;
    attribution?: {
      sources: Array<{
        userId: string;
        userName: string;
        sourceType: 'liked' | 'recent' | 'playlist' | 'top_tracks';
        sourceDetail?: string;
      }>;
    };
  }>(null);
  const [judgement, setJudgement] = useState({ titleOk: false, artistOk: false, yearOk: false });
  const [lastPoints, setLastPoints] = useState<number | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [navError, setNavError] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<{ name: string; is_active: boolean } | null>(null);
  const [sdkState, setSdkState] = useState<any>(null);
  const [volume, setVol] = useState<number>(80);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);
  const [likeBusy, setLikeBusy] = useState(false);
  const [songPreference, setSongPreference] = useState<{ includeLiked: boolean; includeRecent: boolean; includePlaylist: boolean; playlistId?: string }>({ includeLiked: true, includeRecent: false, includePlaylist: false });
  const [playlists, setPlaylists] = useState<Array<{ id: string; name: string; tracks: { total: number } }> | null>(null);
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

  // Auto-fetch playlists when user is authenticated
  useEffect(() => {
    if (me) {
      fetchPlaylists();
    }
  }, [me]);

  // Handle URL path changes
  useEffect(() => {
    const handlePathChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePathChange);
    return () => window.removeEventListener('popstate', handlePathChange);
  }, []);

  // On load: detect auth redirect and/or existing session
  useEffect(() => {
    const url = new URL(window.location.href);
    const authed = url.searchParams.get('authed');
    const groupParam = url.searchParams.get('group');
    const autojoin = url.searchParams.get('autojoin') === '1';
    const created = url.searchParams.get('created') === '1';
    const connect = url.searchParams.get('connect') === '1';
    const error = url.searchParams.get('error');

    if (error) {
      if (error === 'create_failed') {
        alert('Failed to create game. Please try again.');
      } else if (error === 'invalid_group') {
        alert('Invalid group code. Please check the code and try again.');
      }
    }

    if (groupParam) {
      setGroup(groupParam);
      if (created) {
        setToast('Game created successfully! Select your music preferences.');
        setTimeout(() => setToast(null), 3000);
      }
    }

    async function checkMe() {
      try {
        const r = await fetch('/api/me', { credentials: 'include' });
        if (r.ok) {
          const data = await r.json();
          setMe(data);
          if (!group && data.group) {
            setGroup(data.group);
            // Navigate to /game if we have a group but we're not already there
            if (window.location.pathname !== '/game') {
              window.history.pushState({}, '', '/game');
              setCurrentPath('/game');
            }
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
      url.searchParams.delete('created');
      url.searchParams.delete('connect');
      url.searchParams.delete('error');
      const search = url.searchParams.toString();
      window.history.replaceState({}, '', url.pathname + (search ? `?${search}` : ''));
    } else {
      // Also try to detect existing session silently
      checkMe();
      // If instructed to connect, redirect to Spotify login carrying group & return params
      if (connect) {
        const stateVal = (groupParam || group) ? `group:${encodeURIComponent(groupParam || group)}` : 'mm';
        // If connecting with a group parameter, assume they're joining as a player unless it's a new group
        const hostParam = groupParam ? '' : '&host=true';
        window.location.href = `/auth/login?state=${stateVal}${hostParam}`;
      }
    }
  }, []);

  // Poll lobby members so everyone can see who is in the game
  useEffect(() => {
    if (!group) return;
    let iv: any;
    const fetchMembers = async () => {
      try {
        const r = await fetch(`/api/lobby/${encodeURIComponent(group)}`, { credentials: 'include' });
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

  // Poll game state so players can see contributions even without host controls
  useEffect(() => {
    if (!group) return;
    let iv: any;
    const fetchState = async () => {
      try {
        const r = await fetch(`/api/game/${encodeURIComponent(group)}/state`, { credentials: 'include' });
        if (r.ok) {
          const data = await r.json();
          setState((prev: any) => ({ ...prev, ...data }));
          if (data?.answer) setAnswer(data.answer);
          else setAnswer(null);
        }
      } catch {}
    };
    fetchState();
    iv = setInterval(fetchState, 5000);
    return () => iv && clearInterval(iv);
  }, [group]);

  async function fetchPlaylists() {
    try {
      const r = await fetch('/api/playlists', { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        setPlaylists(data.playlists || []);
      }
    } catch (e) {
      console.warn('Failed to fetch playlists:', e);
    }
  }


  const loginUrl = useMemo(() => {
    const state = group ? `group:${encodeURIComponent(group)}` : 'mm';
    // Check if user would be a host (first in group or current host)
    const wouldBeHost = !members || members.length === 0 || members.some(m => m.id === me?.id && m.role === 'host');
    return `/auth/login?state=${state}${wouldBeHost ? '&host=true' : ''}`;
  }, [group, members, me]);

  // Build shareable link and QR when in game page with a group
  useEffect(() => {
    if (!group || currentPath !== '/game') return;
    const origin = window.location.origin; // Use current host/port
    const link = `${origin}/game?group=${encodeURIComponent(group)}&autojoin=1&connect=1`;
    setShareLink(link);
    if (qrVisible) {
      QRCode.toDataURL(link, { width: 256, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
    }
  }, [group, currentPath, qrVisible]);

  if (currentPath === '/') {
    return <Landing />;
  }

  if (currentPath === '/game') {
    return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent mb-2">
              🎵 Beat Battle
            </h1>
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl px-4 py-2 inline-block">
              <p className="text-slate-300">Group: <code className="text-green-400 font-mono font-bold text-lg">{group}</code></p>
            </div>
          </div>
          {/* Sharing Section */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <span className="text-2xl mr-2">🔗</span>
              Share Game
            </h3>

            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Game Code</label>
                  <div className="flex items-center gap-2">
                    <code className="bg-slate-900/70 text-green-400 font-mono text-lg font-bold px-3 py-2 rounded-lg border border-slate-600">
                      {group}
                    </code>
                    <button
                      title="Copy group code"
                      className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium"
                      onClick={async () => {
                        await navigator.clipboard.writeText(group);
                        setToast('Game code copied');
                        setTimeout(() => setToast(null), 2000);
                      }}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                  onClick={() => setQrVisible((v) => !v)}
                >
                  {qrVisible ? '🙈 Hide QR' : '📱 Show QR'}
                </button>
                <div className="flex-1 min-w-0 flex gap-2">
                  <input
                    readOnly
                    value={shareLink}
                    className="flex-1 bg-slate-900/70 border border-slate-600 text-slate-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button
                    title="Copy join link"
                    className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium whitespace-nowrap"
                    onClick={async () => {
                      await navigator.clipboard.writeText(shareLink);
                      setToast('Join link copied');
                      setTimeout(() => setToast(null), 2000);
                    }}
                  >
                    🔗 Copy Link
                  </button>
                </div>
              </div>
            </div>
            {qrVisible && (
              <div className="mt-6 flex flex-col items-center">
                <div className="bg-white p-4 rounded-xl shadow-lg">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="Join QR" width={200} height={200} className="rounded-lg" />
                  ) : (
                    <div className="w-50 h-50 bg-slate-200 rounded-lg flex items-center justify-center">
                      <span className="text-slate-500">Generating QR…</span>
                    </div>
                  )}
                </div>
                {window.location.hostname === '127.0.0.1' && (
                  <div className="mt-3 text-amber-400 text-sm text-center bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                    ⚠️ 127.0.0.1 works only on this device. For others on your network, set WEB_URL and open the app using your LAN IP.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Authentication Section */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <span className="text-2xl mr-2">🎧</span>
              Spotify Connection
            </h3>

            {!me ? (
              <div className="text-center">
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                  <p className="text-red-400 flex items-center justify-center gap-2">
                    <span>❌</span>
                    Not connected to Spotify
                  </p>
                </div>
                <a href={loginUrl}>
                  <button className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-green-500/25">
                    🚀 Connect with Spotify
                  </button>
                </a>
              </div>
            ) : (
              <div>
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
                  <p className="text-green-400 flex items-center gap-2">
                    <span>✅</span>
                    Connected as <strong className="text-white">{me.name}</strong>
                    <span className="text-slate-400">({me.id})</span>
                  </p>
                </div>
                <button
                  className="bg-red-600 hover:bg-red-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  onClick={async () => {
                    try {
                      await fetch('/api/logout', {
                        method: 'POST',
                        credentials: 'include'
                      });

                      setMe(null);
                      setMembers(null);
                      setGroup('');
                      setPlaylists(null);
                      setSongPreference({ includeLiked: true, includeRecent: false, includePlaylist: false });

                      window.history.pushState({}, '', '/');
                      setCurrentPath('/');

                    } catch (e) {
                      console.error('Logout failed:', e);
                      setMe(null);
                      setMembers(null);
                      setGroup('');
                      window.history.pushState({}, '', '/');
                      setCurrentPath('/');
                    }
                  }}
                >
                  🚪 Logout
                </button>
              </div>
            )}
          </div>

          {me && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                <span className="text-2xl mr-2">{me.role === 'host' ? '👑' : '🎮'}</span>
                Your Role
              </h3>
              <div className={`rounded-xl p-4 ${me.role === 'host' ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-blue-500/10 border border-blue-500/30'}`}>
                <div className="flex items-center gap-3">
                  <strong className="text-white text-lg">{me.name}</strong>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${me.role === 'host' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                    {me.role === 'host' ? '👑 Host' : '🎮 Player'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {me && !members?.some(m => m.id === me.id || m.id === `${me.id}#participant`) && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <span className="text-2xl mr-2">🎵</span>
                Choose Your Music Sources
              </h3>
              <p className="text-slate-300 text-sm mb-6">
                Select your music sources for the game. Your songs will be combined with other players' choices.
              </p>

              <div className="space-y-4">
                <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-600 hover:border-green-500/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={songPreference.includeLiked}
                    onChange={(e) => setSongPreference({ ...songPreference, includeLiked: e.target.checked })}
                    className="w-4 h-4 text-green-500 bg-slate-700 border-slate-500 rounded focus:ring-green-500 focus:ring-2"
                  />
                  <span className="text-white flex items-center gap-2">
                    <span className="text-lg">❤️</span>
                    My liked songs
                  </span>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-600 hover:border-blue-500/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={songPreference.includeRecent}
                    onChange={(e) => setSongPreference({ ...songPreference, includeRecent: e.target.checked })}
                    className="w-4 h-4 text-blue-500 bg-slate-700 border-slate-500 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-white flex items-center gap-2">
                    <span className="text-lg">🕒</span>
                    My recently played tracks
                  </span>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-600 hover:border-purple-500/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={songPreference.includePlaylist}
                    onChange={(e) => setSongPreference({
                      ...songPreference,
                      includePlaylist: e.target.checked,
                      playlistId: e.target.checked ? (playlists?.[0]?.id || songPreference.playlistId) : undefined
                    })}
                    className="w-4 h-4 text-purple-500 bg-slate-700 border-slate-500 rounded focus:ring-purple-500 focus:ring-2"
                  />
                  <span className="text-white flex items-center gap-2">
                    <span className="text-lg">📝</span>
                    A specific playlist
                  </span>
                </label>

                {songPreference.includePlaylist && playlists && (
                  <div className="ml-8 mt-2">
                    <select
                      value={songPreference.playlistId || ''}
                      onChange={(e) => setSongPreference({ ...songPreference, playlistId: e.target.value })}
                      className="w-full bg-slate-900/70 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    >
                      {playlists.map(playlist => (
                        <option key={playlist.id} value={playlist.id} className="bg-slate-800">
                          {playlist.name} ({playlist.tracks.total} tracks)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!playlists && songPreference.includePlaylist && (
                  <div className="ml-8 mt-2 text-slate-400 text-sm flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                    Loading playlists...
                  </div>
                )}
              </div>

              <div className="mt-6 text-center">
                <button
                  onClick={async () => {
                    try {
                      const r = await fetch('/api/lobby/join', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ group, preference: songPreference }),
                        credentials: 'include'
                      });
                      const data = await r.json();
                      if (r.ok) {
                        setMembers(data.members || null);
                        setToast('Successfully joined the game!');
                        setTimeout(() => setToast(null), 2000);
                        try {
                          const rm = await fetch('/api/me', { credentials: 'include' });
                          if (rm.ok) setMe(await rm.json());
                        } catch {}
                      } else {
                        alert(`Failed to join game: ${data.error || 'Unknown error'}`);
                      }
                    } catch (e) {
                      console.error('Failed to join lobby:', e);
                      alert('Failed to join game. Please try again.');
                    }
                  }}
                  disabled={
                    (!songPreference.includeLiked && !songPreference.includeRecent && !songPreference.includePlaylist) ||
                    (songPreference.includePlaylist && !songPreference.playlistId)
                  }
                  className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none shadow-lg hover:shadow-green-500/25"
                >
                  🎮 Join Game
                </button>
              </div>
            </div>
          )}

          {members && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <span className="text-2xl mr-2">👥</span>
                Game Members ({members.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-600">
                    {m.avatar ? (
                      <img src={m.avatar} alt={m.name} width={40} height={40} className="rounded-full object-cover border-2 border-slate-500" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white flex items-center justify-center text-sm font-bold">
                        {m.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium truncate">{m.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.role === 'host' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                          {m.role === 'host' ? '👑' : '🎮'}
                        </span>
                      </div>
                      {state?.contrib && (
                        <div className="text-xs text-slate-400">
                          {state.contrib[m.id.split('#')[0]] ?? 0} songs contributed
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* Toast */}
          {toast && (
            <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-600 text-white px-4 py-3 rounded-xl shadow-2xl animate-pulse">
              <div className="flex items-center gap-2">
                <span className="text-green-400">✅</span>
                {toast}
              </div>
            </div>
          )}

          {isHost && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <span className="text-2xl mr-2">🎮</span>
                Host Controls
              </h3>
              <div className="flex gap-3 flex-wrap">
                <button 
                  disabled={!me || !group.trim()} 
                  onClick={async () => {
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
                  }}
                  className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none shadow-lg hover:shadow-green-500/25"
                >
                  🚀 Start Game
                </button>
                <button 
                  className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none shadow-lg hover:shadow-blue-500/25" 
                  disabled={!me || !group.trim()} 
                  onClick={async () => {
                    try { await transferPlaybackToPlayer(); } catch {}
                    setAnswer(null);
                    setJudgement({ titleOk: false, artistOk: false, yearOk: false });
                    setLastPoints(null);
                    setRevealError(null);
                    await fetchPlayableNext();
                  }}
                >
                  ⏭️ Next Track
                </button>
              </div>
            </div>
          )}

          {isHost && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <span className="text-2xl mr-2">🎵</span>
                Playback Status
              </h3>
              <audio ref={audioRef} controls className="hidden" />
              <div className="space-y-2">
                <div className="text-sm text-slate-300 flex items-center gap-2">
                  <span className="text-lg">🎧</span>
                  Playing via Spotify Web Playback SDK (requires Premium)
                </div>
                <div className={`text-sm flex items-center gap-2 ${deviceInfo?.is_active ? 'text-green-400' : 'text-red-400'}`}>
                  <span>{deviceInfo?.is_active ? '✅' : '❌'}</span>
                  Device: <strong>{deviceInfo?.name || 'Web Player'}</strong> — {deviceInfo?.is_active ? 'active' : 'inactive'}
                </div>
                {state?.index !== undefined && state?.total !== undefined && (
                  <div className="text-sm text-slate-300 flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    Track <strong>{state.index + 1}</strong> of <strong>{state.total}</strong>
                  </div>
                )}
                {navError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                    <span className="text-lg mr-2">⚠️</span>
                    {navError}
                  </div>
                )}
              </div>
            </div>
          )}

      {/* Mini player bar */}
      {isHost && (
      <div className="fixed left-0 right-0 bottom-0 bg-gray-900 text-white px-3 py-2 flex items-center gap-3">
        <button onClick={() => fetchPlayablePrev().then(() => transferPlaybackToPlayer()).catch(() => {})} className="bg-gray-800 text-white border-0 px-2.5 py-1.5 rounded">
          ⏮
        </button>
        <button onClick={() => togglePlay()} className="bg-green-500 text-black border-0 px-2.5 py-1.5 rounded">
          {sdkState?.paused ? 'Play' : 'Pause'}
        </button>
        <button onClick={() => fetchPlayableNext().then(() => transferPlaybackToPlayer()).catch(() => {})} className="bg-gray-800 text-white border-0 px-2.5 py-1.5 rounded">
          ⏭
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-xs opacity-80">Vol</span>
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
        <div className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">
          <span>{sdkState ? 'Now Playing' : 'Ready'}</span>
        </div>
        <div className="tabular-nums">
          {formatDuration(sdkState?.position || 0)} / {formatDuration(sdkState?.duration || state?.track?.duration_ms)}
        </div>
      </div>
      )}

          {isHost && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <span className="text-2xl mr-2">📋</span>
                Reveal & Judge
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-center">
                  <button 
                    disabled={!me || !group.trim() || !state?.track?.id} 
                    onClick={async () => {
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
                    }}
                    className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none shadow-lg hover:shadow-purple-500/25"
                  >
                    🔍 Reveal Answer
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-600 hover:border-green-500/50 cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      checked={judgement.titleOk} 
                      onChange={(e) => setJudgement({ ...judgement, titleOk: e.target.checked })} 
                      className="w-4 h-4 text-green-500 bg-slate-700 border-slate-500 rounded focus:ring-green-500 focus:ring-2"
                    />
                    <span className="text-white flex items-center gap-2">
                      <span className="text-lg">🎵</span>
                      <div>
                        <div className="font-medium">Title correct</div>
                        <div className="text-xs text-slate-400">+1 point</div>
                      </div>
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-600 hover:border-blue-500/50 cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      checked={judgement.artistOk} 
                      onChange={(e) => setJudgement({ ...judgement, artistOk: e.target.checked })} 
                      className="w-4 h-4 text-blue-500 bg-slate-700 border-slate-500 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-white flex items-center gap-2">
                      <span className="text-lg">🎤</span>
                      <div>
                        <div className="font-medium">Artist correct</div>
                        <div className="text-xs text-slate-400">+1 point</div>
                      </div>
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-600 hover:border-purple-500/50 cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      checked={judgement.yearOk} 
                      onChange={(e) => setJudgement({ ...judgement, yearOk: e.target.checked })} 
                      className="w-4 h-4 text-purple-500 bg-slate-700 border-slate-500 rounded focus:ring-purple-500 focus:ring-2"
                    />
                    <span className="text-white flex items-center gap-2">
                      <span className="text-lg">📅</span>
                      <div>
                        <div className="font-medium">Year correct</div>
                        <div className="text-xs text-slate-400">+5 points</div>
                      </div>
                    </span>
                  </label>
                </div>
              </div>
              {answer && (
                <div className="mt-6 flex items-center gap-4 p-4 border border-slate-600 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-xl">
            <img
              src={state?.track?.album?.images?.[0]?.url || state?.track?.album?.images?.[1]?.url}
              alt={answer.title}
              className="w-24 h-24 object-cover rounded"
            />
            <div className="flex flex-col">
              <div className="font-bold text-base">{answer.title}</div>
              <div className="opacity-85 mt-0.5">{answer.artist}</div>
              <div className="opacity-70 mt-0.5">Album: {state?.track?.album?.name || '—'}</div>
              <div className="opacity-70 mt-0.5">Year: {answer.year} · Duration: {formatDuration(state?.track?.duration_ms)}</div>

              {answer.attribution && (
                <div className="mt-2 p-2 bg-white/10 rounded">
                  <div className="text-xs font-semibold mb-1 text-green-500">Song Sources:</div>
                  {answer.attribution.sources.map((source, idx) => (
                    <div key={idx} className="text-xs opacity-90 mb-0.5">
                      <strong>{source.userName}</strong> - {
                        source.sourceType === 'liked' ? 'Liked Songs' :
                        source.sourceType === 'recent' ? 'Recently Played' :
                        source.sourceType === 'playlist' ? (source.sourceDetail || 'Playlist') :
                        'Top Tracks'
                      }
                    </div>
                  ))}
                </div>
              )}

              {state?.track?.id && (
                <a
                  href={`https://open.spotify.com/track/${state.track.id}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 text-green-500 no-underline font-semibold"
                >
                  Open in Spotify
                </a>
              )}
            </div>
          </div>
        )}
              {revealError && (
                <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    {revealError}
                  </div>
                </div>
              )}
              {lastPoints !== null && (
                <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                  <div className="text-green-400 font-semibold flex items-center justify-center gap-2">
                    <span className="text-lg">🎆</span>
                    Awarded: <strong className="text-white text-lg">{lastPoints}</strong> point{lastPoints === 1 ? '' : 's'}
                  </div>
                </div>
              )}
            </div>
          )}

      {!isHost && answer && (
        <section className="mt-6">
          <div className="flex items-center gap-4 p-3 border border-gray-300 rounded-lg bg-black text-white">
            <img
              src={state?.track?.album?.images?.[0]?.url || state?.track?.album?.images?.[1]?.url}
              alt={answer.title}
              className="w-24 h-24 object-cover rounded"
            />
            <div className="flex flex-col">
              <div className="font-bold text-base">{answer.title}</div>
              <div className="opacity-85 mt-0.5">{answer.artist}</div>
              <div className="opacity-70 mt-0.5">Album: {state?.track?.album?.name || '—'}</div>
              <div className="opacity-70 mt-0.5">Year: {answer.year} · Duration: {formatDuration(state?.track?.duration_ms)}</div>
              {answer.attribution && (
                <div className="mt-2 p-2 bg-white/10 rounded">
                  <div className="text-xs font-semibold mb-1 text-green-500">Song Sources:</div>
                  {answer.attribution.sources.map((source, idx) => (
                    <div key={idx} className="text-xs opacity-90 mb-0.5">
                      <strong>{source.userName}</strong> - {
                        source.sourceType === 'liked' ? 'Liked Songs' :
                        source.sourceType === 'recent' ? 'Recently Played' :
                        source.sourceType === 'playlist' ? (source.sourceDetail || 'Playlist') :
                        'Top Tracks'
                      }
                    </div>
                  ))}
                </div>
              )}
              {state?.track?.id && (
                <a
                  href={`https://open.spotify.com/track/${state.track.id}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 text-green-500 no-underline font-semibold"
                >
                  Open in Spotify
                </a>
              )}
            </div>
          </div>
        </section>
      )}

        </div>
      </div>
    </div>
    );
  }

  // 404 fallback
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-8xl mb-6">🎵</div>
          <h1 className="text-4xl font-bold text-white mb-4">Page Not Found</h1>
          <p className="text-slate-300 mb-8">The page you're looking for doesn't exist.</p>
          <a href="/" className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-green-500/25">
            🏠 Go back to home
          </a>
        </div>
      </div>
    </div>
  );
}
