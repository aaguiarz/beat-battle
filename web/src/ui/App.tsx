import React, { useEffect, useMemo, useRef, useState } from 'react';
import { playTrackId, transferPlaybackToPlayer, pausePlayback } from '../spotify/player';
import { HostPlaybackControls } from './components/HostPlaybackControls';
import { transfer as transferConnect, playOnDevice as playOnConnect, pause as pauseConnect } from '../utils/playback';
import QRCode from 'qrcode';
import { Landing } from './Landing';
import { SongCard } from './components/SongCard';
import { MusicPreferencesForm } from './components/MusicPreferencesForm';
import { GameHeader } from './components/GameHeader';
import { ShareGameCard } from './components/ShareGameCard';
import { LoginPrompt } from './components/LoginPrompt';
import { GameMembersList } from './components/GameMembersList';
import { HostControls } from './components/HostControls';
import { PlaybackStatus } from './components/PlaybackStatus';
import { RevealJudge } from './components/RevealJudge';
import { MiniPlayer } from './components/MiniPlayer';
import { useAuth } from '../hooks/useAuth';
import { useGameState } from '../hooks/useGameState';
import { useSpotifyPlayer } from '../hooks/useSpotifyPlayer';
import { useToast } from '../hooks/useToast';

export function App() {
  const [group, setGroup] = useState('');
  const [playbackMode, setPlaybackMode] = useState<'connect' | 'websdk'>('connect');
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string>('');
  const [judgement, setJudgement] = useState({ titleOk: false, artistOk: false, yearOk: false });
  const [lastPoints, setLastPoints] = useState<number | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [navError, setNavError] = useState<string | null>(null);
  const [positionMs, setPositionMs] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(localStorage.getItem('mm_device_id'));
  const [songPreference, setSongPreference] = useState<{ includeLiked: boolean; includeRecent: boolean; includePlaylist: boolean; playlistId?: string }>({ includeLiked: true, includeRecent: false, includePlaylist: false });
  const [playlists, setPlaylists] = useState<Array<{ id: string; name: string; tracks: { total: number } }> | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [gameTimer, setGameTimer] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Use custom hooks
  const { user: me, logout, refreshUser } = useAuth();
  const { members, state, answer, setAnswer, setMembers, startGame, nextTrack: gameNextTrack, prevTrack: gamePrevTrack, revealAnswer } = useGameState(group);
  const { sdkState, deviceInfo, volume, updateVolume, togglePlayback, activate } = useSpotifyPlayer(playbackMode === 'websdk');
  const { toast, showToast } = useToast();
  const clipTimer = useRef<any>(null);
  const clipCfgRef = useRef<{ stopAfterMs: number }>({ stopAfterMs: 0 });

  // Timer management functions
  const startGameTimer = () => {
    setGameTimer(0);
    setIsPaused(false);
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
    }
    gameTimerRef.current = setInterval(() => {
      setGameTimer(prev => prev + 1);
    }, 1000);
  };

  const pauseGameTimer = () => {
    setIsPaused(true);
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }
  };

  const resumeGameTimer = () => {
    setIsPaused(false);
    if (!gameTimerRef.current) {
      gameTimerRef.current = setInterval(() => {
        setGameTimer(prev => prev + 1);
      }, 1000);
    }
  };

  const resetGameTimer = () => {
    setGameTimer(0);
    setIsPaused(false);
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (gameTimerRef.current) {
        clearInterval(gameTimerRef.current);
      }
    };
  }, []);

  function scheduleAutoStop() {
    const ms = clipCfgRef.current.stopAfterMs;
    if (!ms || ms <= 0) return;
    if (clipTimer.current) clearTimeout(clipTimer.current);
    clipTimer.current = setTimeout(async () => {
      try { await handlePause(); } catch {}
    }, ms);
  }

  const isHost = useMemo(() => me?.role === 'host', [me]);
  const hostHasJoined = useMemo(() =>
    me && members?.some(m => m.id === me.id || m.id === `${me.id}#participant`),
    [me, members]
  );

  const handleDeviceSelect = (deviceId: string | null) => {
    setSelectedDeviceId(deviceId);
    if (deviceId) {
      localStorage.setItem('mm_device_id', deviceId);
    } else {
      localStorage.removeItem('mm_device_id');
    }
  };
  function formatDuration(ms?: number) {
    if (!ms && ms !== 0) return '—';
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const handleStartGame = async () => {
    try {
      // If host selected a Connect device, use it; otherwise use Web SDK
      const chosen = localStorage.getItem('mm_device_id');
      if (playbackMode === 'connect' && chosen) {
        try { await transferConnect(chosen, true); } catch {}
      } else if (playbackMode === 'websdk') {
        await activate();
        await transferPlaybackToPlayer();
      } else {
        setNavError('Select a Connect device in Host Playback');
        return;
      }
      setAnswer(null);
      setJudgement({ titleOk: false, artistOk: false, yearOk: false });
      setLastPoints(null);
      setRevealError(null);
      setNavError(null);
      await startGame();
      startGameTimer(); // Start timer when game starts
      refreshUser();
    } catch (error) {
      setNavError(error instanceof Error ? error.message : 'Failed to start game');
    }
  };

  const handleNextTrack = async () => {
    try {
      const chosen = localStorage.getItem('mm_device_id');
      if (playbackMode === 'connect' && chosen) {
        try { await transferConnect(chosen, true); } catch {}
      } else if (playbackMode === 'websdk') {
        await activate();
        await transferPlaybackToPlayer();
      } else {
        setNavError('Select a Connect device in Host Playback');
        return;
      }
      setAnswer(null);
      setJudgement({ titleOk: false, artistOk: false, yearOk: false });
      setLastPoints(null);
      setRevealError(null);
      setNavError(null);
      await gameNextTrack();
      startGameTimer(); // Restart timer for next track
    } catch (error) {
      setNavError(error instanceof Error ? error.message : 'Failed to go to next track');
    }
  };

  const handlePause = async () => {
    try {
      const chosen = localStorage.getItem('mm_device_id');

      if (!isPaused) {
        // Pause playback and timer
        if (playbackMode === 'connect' && chosen) {
          await pauseConnect(chosen);
        } else {
          await pausePlayback();
        }
        pauseGameTimer();
      } else {
        // Resume playback and timer
        if (playbackMode === 'connect' && chosen) {
          const { resume } = await import('../utils/playback');
          await resume(chosen);
        } else {
          const { resumePlayback } = await import('../spotify/player');
          await resumePlayback();
        }
        resumeGameTimer();
      }
    } catch (error) {
      setNavError(error instanceof Error ? error.message : `Failed to ${isPaused ? 'resume' : 'pause'}`);
    }
  };

  const handlePrevTrack = async () => {
    try {
      if (playbackMode === 'websdk') {
        await activate();
      }
      setNavError(null);
      await gamePrevTrack();
      const chosen = localStorage.getItem('mm_device_id');
      if (playbackMode === 'connect' && chosen) {
        try { await transferConnect(chosen, true); } catch {}
      } else if (playbackMode === 'websdk') {
        await transferPlaybackToPlayer();
      }
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

  // Auto-play when we receive a new track (with clean start and optional auto-stop)
  useEffect(() => {
    const id = state?.track?.id as string | undefined;
    if (!id) return;
    const chosen = localStorage.getItem('mm_device_id');
    (async () => {
      const startMs = 0;
      if (playbackMode === 'connect' && chosen) {
        try {
          await transferConnect(chosen, true);
          await playOnConnect({ deviceId: chosen, trackId: id, positionMs: startMs });
          scheduleAutoStop();
        } catch (e) {
          console.warn('Connect playback failed', e);
          setNavError('Failed to control Connect device. Open Spotify on the device and try again.');
        }
      } else if (playbackMode === 'websdk') {
        try {
          await playTrackId(id, startMs);
          scheduleAutoStop();
        } catch (e) {
          console.warn('Web SDK playback failed', e);
        }
      }
    })();
  }, [state?.track?.id, playbackMode]);

  // Update playback time display (Web SDK only; no server polling in Connect mode)
  useEffect(() => {
    if (playbackMode !== 'websdk') return;
    setDurationMs(sdkState?.duration ?? state?.track?.duration_ms ?? 0);
    setPositionMs(sdkState?.position ?? 0);
  }, [playbackMode, sdkState?.position, sdkState?.duration, state?.track?.duration_ms]);

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

  // Fetch server config for playback and clip
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/config', { credentials: 'include' });
        if (r.ok) {
          const cfg = await r.json();
          if (cfg?.playbackMode === 'websdk' || cfg?.playbackMode === 'connect') {
            setPlaybackMode(cfg.playbackMode);
          }
          if (cfg?.clip) {
            clipCfgRef.current = { stopAfterMs: Number(cfg.clip.stopAfterMs || 0) };
          }
        }
      } catch {}
    })();
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
          <GameHeader
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
          <ShareGameCard
            group={group}
            qrVisible={qrVisible}
            qrDataUrl={qrDataUrl}
            shareLink={shareLink}
            onToggleQR={() => setQrVisible((v) => !v)}
            onCopyGameCode={async () => {
              await navigator.clipboard.writeText(group);
              showToast('Game code copied');
            }}
            onCopyShareLink={async () => {
              await navigator.clipboard.writeText(shareLink);
              showToast('Invitation link copied');
            }}
          />

          {!me && <LoginPrompt loginUrl={loginUrl} />}


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

          {members && <GameMembersList members={members} state={state} />}


          {/* Toast */}
          {toast && (
            <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-600 text-white px-4 py-3 rounded-xl shadow-2xl animate-pulse">
              <div className="flex items-center gap-2">
                <span className="text-green-400">✅</span>
                {toast}
              </div>
            </div>
          )}

          {isHost && hostHasJoined && playbackMode === 'connect' && (
            <HostPlaybackControls
              currentTrackId={state?.track?.id}
              selectedDeviceId={selectedDeviceId}
              onDeviceSelect={handleDeviceSelect}
            />
          )}

          {isHost && hostHasJoined && (
            <HostControls
              user={me}
              group={group}
              members={members || undefined}
              onStartGame={handleStartGame}
              onPause={handlePause}
              onNextTrack={handleNextTrack}
              index={state?.index}
              total={state?.total}
              positionMs={playbackMode === 'websdk' ? positionMs : undefined}
              durationMs={playbackMode === 'websdk' ? durationMs : undefined}
              isPaused={isPaused}
              gameTimer={gameTimer}
            />
          )}

          {isHost && hostHasJoined && playbackMode === 'websdk' && (
            <PlaybackStatus
              deviceInfo={deviceInfo}
              state={state}
              navError={navError}
              audioRef={audioRef}
            />
          )}


          {isHost && hostHasJoined && (
            <RevealJudge
              user={me}
              group={group}
              state={state}
              answer={answer}
              judgement={judgement}
              lastPoints={lastPoints}
              revealError={revealError}
              onReveal={handleReveal}
              onJudgementChange={setJudgement}
            />
          )}

          {!isHost && answer && state?.track && (
            <div className="mt-6">
              <SongCard track={state.track} answer={answer} />
            </div>
          )}

          {isHost && hostHasJoined && playbackMode === 'websdk' && (
            <MiniPlayer
              sdkState={sdkState}
              state={state}
              volume={volume}
              onPrevTrack={handlePrevTrack}
              onTogglePlay={togglePlayback}
              onNextTrack={async () => {
                try { await activate(); } catch {}
                // fetchPlayableNext().then(() => transferPlaybackToPlayer()).catch(() => {});
              }}
              onVolumeChange={async (v) => {
                await updateVolume(v / 100);
              }}
              formatDuration={formatDuration}
            />
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
