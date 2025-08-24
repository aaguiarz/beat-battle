import React, { useEffect, useMemo, useRef, useState } from 'react';
import { playTrackId, transferPlaybackToPlayer } from '../spotify/player';
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

          {isHost && (
            <HostControls
              user={me}
              group={group}
              onStartGame={handleStartGame}
              onNextTrack={handleNextTrack}
            />
          )}

          {isHost && (
            <PlaybackStatus
              deviceInfo={deviceInfo}
              state={state}
              navError={navError}
              audioRef={audioRef}
            />
          )}


          {isHost && (
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

          {isHost && (
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
