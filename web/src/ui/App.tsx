import React, { useEffect, useMemo, useRef, useState } from 'react';
import { playTrackId, transferPlaybackToPlayer } from '../spotify/player';
import QRCode from 'qrcode';
import { Landing } from './Landing';
import { Card } from './components/Card';
import { GradientButton } from './components/GradientButton';
import { SongCard } from './components/SongCard';
import { UserSection } from './components/UserSection';
import { MusicPreferencesForm } from './components/MusicPreferencesForm';
import { useAuth } from '../hooks/useAuth';
import { useGameState } from '../hooks/useGameState';
import { useSpotifyPlayer } from '../hooks/useSpotifyPlayer';
import { useToast } from '../hooks/useToast';

export function App() {
  const [group, setGroup] = useState('');
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string>('');
  const [judgement, setJudgement] = useState({ titleOk: false, artistOk: false, yearOk: false });
  const [lastPoints, setLastPoints] = useState<number | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [navError, setNavError] = useState<string | null>(null);
  const [songPreference, setSongPreference] = useState<{ includeLiked: boolean; includeRecent: boolean; includePlaylist: boolean; playlistId?: string }>({ includeLiked: true, includeRecent: false, includePlaylist: false });
  const [playlists, setPlaylists] = useState<Array<{ id: string; name: string; tracks: { total: number } }> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Use custom hooks
  const { user: me, logout, refreshUser } = useAuth();
  const { members, state, answer, setAnswer, setMembers, startGame, nextTrack: gameNextTrack, prevTrack: gamePrevTrack, revealAnswer } = useGameState(group);
  const { sdkState, deviceInfo, volume, updateVolume, togglePlayback, activate } = useSpotifyPlayer();
  const { toast, showToast } = useToast();
  
  const isHost = useMemo(() => me?.role === 'host', [me]);
  function formatDuration(ms?: number) {
    if (!ms && ms !== 0) return '—';
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const handleStartGame = async () => {
    try {
      await activate();
      await transferPlaybackToPlayer();
      setAnswer(null);
      setJudgement({ titleOk: false, artistOk: false, yearOk: false });
      setLastPoints(null);
      setRevealError(null);
      setNavError(null);
      await startGame();
      refreshUser();
    } catch (error) {
      setNavError(error instanceof Error ? error.message : 'Failed to start game');
    }
  };

  const handleNextTrack = async () => {
    try {
      await activate();
      await transferPlaybackToPlayer();
      setAnswer(null);
      setJudgement({ titleOk: false, artistOk: false, yearOk: false });
      setLastPoints(null);
      setRevealError(null);
      setNavError(null);
      await gameNextTrack();
    } catch (error) {
      setNavError(error instanceof Error ? error.message : 'Failed to go to next track');
    }
  };

  const handlePrevTrack = async () => {
    try {
      await activate();
      setNavError(null);
      await gamePrevTrack();
      await transferPlaybackToPlayer();
    } catch (error) {
      setNavError(error instanceof Error ? error.message : 'Failed to go to previous track');
    }
  };

  const handleReveal = async () => {
    try {
      setRevealError(null);
      await revealAnswer();
    } catch (error) {
      setRevealError(error instanceof Error ? error.message : 'Failed to reveal answer');
    }
  };

  // Auto-play when we receive a new track
  useEffect(() => {
    const id = state?.track?.id as string | undefined;
    if (id) {
      playTrackId(id).catch((e) => console.warn('Playback failed', e));
    }
  }, [state?.track?.id]);

  const fetchPlaylists = async () => {
    try {
      const response = await fetch('/api/playlists', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setPlaylists(data.playlists || []);
      }
    } catch (error) {
      console.warn('Failed to fetch playlists:', error);
    }
  };

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
        showToast('Game created successfully! Select your music preferences.', 3000);
      }
    }

    async function checkMe() {
      try {
        refreshUser();
        // Also check if user has a group we should navigate to
        const r = await fetch('/api/me', { credentials: 'include' });
        if (r.ok) {
          const data = await r.json();
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

    // Remove auto-join functionality - let users manually join after selecting music preferences
    // async function maybeAutoJoin() {
    //   try {
    //     if (autojoin && (groupParam || group)) {
    //       const grp = groupParam || group;
    //       const rj = await fetch('/api/lobby/join', {
    //         method: 'POST', headers: { 'Content-Type': 'application/json' },
    //         body: JSON.stringify({ group: grp }), credentials: 'include'
    //       });
    //       await rj.json();
    //     }
    //   } catch {}
    // }

    if (authed === '1') {
      checkMe();
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
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start mb-8 gap-4">
            <div className="text-center lg:flex-1 order-1 lg:order-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                🎵 Beat Battle
              </h1>
            </div>

            {/* User Info */}
            {me && (
              <div className="order-2 lg:order-2">
                <UserSection 
                  user={me} 
                  onLogout={async () => {
                    await logout();
                    setGroup('');
                    setPlaylists(null);
                    setSongPreference({ includeLiked: true, includeRecent: false, includePlaylist: false });
                    window.history.pushState({}, '', '/');
                    setCurrentPath('/');
                  }} 
                />
              </div>
            )}
          </div>
          {/* Sharing Section */}
          <Card title="Share Game" icon="🔗" className="mb-6">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Game Code</label>
                <code className="bg-slate-900/70 text-green-400 font-mono text-lg font-bold px-3 py-2 rounded-lg border border-slate-600 block">
                  {group}
                </code>
              </div>
              <GradientButton
                variant="blue"
                size="sm"
                icon="📋"
                onClick={async () => {
                  await navigator.clipboard.writeText(group);
                  showToast('Game code copied');
                }}
              >
                Copy
              </GradientButton>
              <GradientButton
                variant="purple"
                size="sm"
                icon={qrVisible ? '🙈' : '📱'}
                onClick={() => setQrVisible((v) => !v)}
              >
                {qrVisible ? 'Hide QR' : 'Show QR'}
              </GradientButton>
              <GradientButton
                variant="green"
                size="sm"
                icon="🔗"
                onClick={async () => {
                  await navigator.clipboard.writeText(shareLink);
                  showToast('Invitation link copied');
                }}
              >
                Copy Invitation Link
              </GradientButton>
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
          </Card>

          {/* Login Section - Only show if not authenticated */}
          {!me && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <span className="text-2xl mr-2">🎧</span>
                Spotify Connection Required
              </h3>
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
            </div>
          )}


          {me && !members?.some(m => m.id === me.id || m.id === `${me.id}#participant`) && (
            <MusicPreferencesForm
              preference={songPreference}
              onPreferenceChange={setSongPreference}
              playlists={playlists}
              onJoin={async () => {
                try {
                  const response = await fetch('/api/lobby/join', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ group, preference: songPreference }),
                    credentials: 'include'
                  });
                  const data = await response.json();
                  if (response.ok) {
                    setMembers(data.members || null);
                    showToast('Successfully joined the game!');
                    refreshUser();
                  } else {
                    alert(`Failed to join game: ${data.error || 'Unknown error'}`);
                  }
                } catch (error) {
                  console.error('Failed to join lobby:', error);
                  alert('Failed to join game. Please try again.');
                }
              }}
            />
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
            <Card title="Host Controls" icon="🎮" className="mb-6">
              <div className="flex gap-3 flex-wrap">
                <GradientButton
                  icon="🚀"
                  disabled={!me || !group.trim()}
                  onClick={handleStartGame}
                >
                  Start Game
                </GradientButton>
                <GradientButton
                  variant="blue"
                  icon="⏭️"
                  disabled={!me || !group.trim()}
                  onClick={handleNextTrack}
                >
                  Next Track
                </GradientButton>
              </div>
            </Card>
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


          {isHost && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <span className="text-2xl mr-2">📋</span>
                Reveal & Judge
              </h3>

              <div className="space-y-4">
                <div className="flex justify-center">
                  <GradientButton
                    variant="purple"
                    size="lg"
                    icon="🔍"
                    disabled={!me || !group.trim() || !state?.track?.id}
                    onClick={handleReveal}
                  >
                    Reveal Answer
                  </GradientButton>
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
              {answer && state?.track && (
                <div className="mt-6">
                  <SongCard track={state.track} answer={answer} />
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

          {!isHost && answer && state?.track && (
            <div className="mt-6">
              <SongCard track={state.track} answer={answer} />
            </div>
          )}

          {/* Mini player bar */}
          {isHost && (
            <div className="fixed left-0 right-0 bottom-0 bg-slate-900 text-white px-3 py-2 flex items-center gap-3 border-t border-slate-700 shadow-2xl">
              <button
                onClick={async () => {
                  try { await activatePlayer(); } catch {}
                  fetchPlayablePrev().then(() => transferPlaybackToPlayer()).catch(() => {});
                }}
                className="bg-slate-800 hover:bg-slate-700 text-white border-0 px-2.5 py-1.5 rounded transition-colors"
              >
                ⏮
              </button>
              <button
                onClick={async () => {
                  try { await activatePlayer(); } catch {}
                  togglePlay();
                }}
                className="bg-green-500 hover:bg-green-400 text-black border-0 px-2.5 py-1.5 rounded transition-colors font-medium"
              >
                {sdkState?.paused ? 'Play' : 'Pause'}
              </button>
              <button
                onClick={async () => {
                  try { await activatePlayer(); } catch {}
                  fetchPlayableNext().then(() => transferPlaybackToPlayer()).catch(() => {});
                }}
                className="bg-slate-800 hover:bg-slate-700 text-white border-0 px-2.5 py-1.5 rounded transition-colors"
              >
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
                  className="w-20"
                />
              </div>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                <span className="text-sm">{sdkState ? 'Now Playing' : 'Ready'}</span>
              </div>
              <div className="tabular-nums text-sm">
                {formatDuration(sdkState?.position || 0)} / {formatDuration(sdkState?.duration || state?.track?.duration_ms)}
              </div>
            </div>
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
