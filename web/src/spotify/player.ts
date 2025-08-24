import { loadSpotifySDK } from './sdk';

let deviceId: string | null = null;
let player: any | null = null;
let accessToken: string | null = null;
const stateListeners = new Set<(s: any) => void>();

async function getAccessToken(): Promise<string> {
  if (accessToken) return accessToken;
  const r = await fetch('/api/token', { credentials: 'include' });
  if (!r.ok) throw new Error('Not authenticated');
  const { access_token } = await r.json();
  accessToken = access_token;
  return accessToken!;
}

export async function ensurePlayer(): Promise<string> {
  const token = await getAccessToken();
  const Spotify = await loadSpotifySDK();
  if (!player) {
    player = new Spotify.Player({
      name: 'Beat Battle Web Player',
      getOAuthToken: (cb: (token: string) => void) => cb(token),
      volume: 0.8
    });
    player.addListener('ready', ({ device_id }: any) => {
      deviceId = device_id;
    });
    player.addListener('not_ready', ({ device_id }: any) => {
      if (deviceId === device_id) deviceId = null;
    });
    player.addListener('initialization_error', ({ message }: any) => console.error('init_error', message));
    player.addListener('authentication_error', ({ message }: any) => console.error('auth_error', message));
    player.addListener('account_error', ({ message }: any) => console.error('account_error', message));
    player.addListener('player_state_changed', (state: any) => {
      for (const cb of stateListeners) cb(state);
    });
    await player.connect();
  }
  // Wait until deviceId is set
  for (let i = 0; i < 20 && !deviceId; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!deviceId) throw new Error('Player not ready');
  return deviceId;
}

// Activate element for mobile autoplay support
export async function activatePlayer() {
  await ensurePlayer();
  if (player && player.activateElement) {
    try {
      await player.activateElement();
      console.log('Player activated for mobile autoplay support');
    } catch (error) {
      console.warn('Failed to activate player element:', error);
    }
  }
}

export async function transferPlaybackToPlayer() {
  const token = await getAccessToken();
  const id = await ensurePlayer();

  // Activate element for mobile autoplay support before transfer
  if (player && player.activateElement) {
    try {
      await player.activateElement();
    } catch (error) {
      console.warn('Failed to activate player element before transfer:', error);
    }
  }

  await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ device_ids: [id], play: true })
  });
}

export async function playTrackId(trackId: string, positionMs: number = 0) {
  const token = await getAccessToken();
  const id = await ensurePlayer();

  // Activate element for mobile autoplay support before playing
  if (player && player.activateElement) {
    try {
      await player.activateElement();
    } catch (error) {
      console.warn('Failed to activate player element before play:', error);
    }
  }

  const uri = `spotify:track:${trackId}`;
  // Ensure playback is on our player, then start
  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ uris: [uri], position_ms: Math.max(0, Math.floor(positionMs)) })
  });
}

export function subscribeToPlayerState(cb: (state: any) => void) {
  stateListeners.add(cb);
  return () => stateListeners.delete(cb);
}

export async function listDevices(): Promise<Array<{ id: string; is_active: boolean; name: string; type: string }>> {
  const token = await getAccessToken();
  const r = await fetch('https://api.spotify.com/v1/me/player/devices', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) throw new Error(`devices ${r.status}`);
  const data = await r.json();
  return data.devices || [];
}

export async function getThisDevice(): Promise<{ id: string; name: string; is_active: boolean } | null> {
  const id = deviceId;
  if (!id) return null;
  const devices = await listDevices();
  const dev = devices.find((d) => d.id === id);
  return dev ? { id: dev.id, name: dev.name, is_active: dev.is_active } : null;
}

export async function togglePlay() {
  await ensurePlayer();
  await player!.togglePlay();
}

export async function pausePlayback() {
  await ensurePlayer();
  try {
    await player!.pause();
  } catch (e) {
    // Fallback: if pause isn't available, try toggle when playing
    try { await player!.togglePlay(); } catch {}
  }
}

export async function resumePlayback() {
  await ensurePlayer();
  try {
    await player!.resume();
  } catch (e) {
    // Fallback: if resume isn't available, try toggle when paused
    try { await player!.togglePlay(); } catch {}
  }
}

export async function setVolume(level: number) {
  await ensurePlayer();
  const clamped = Math.max(0, Math.min(1, level));
  await player!.setVolume(clamped);
}

export async function getVolume(): Promise<number> {
  await ensurePlayer();
  try {
    return await player!.getVolume();
  } catch {
    return 0.8;
  }
}
