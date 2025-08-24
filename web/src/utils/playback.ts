export type ConnectDevice = {
  id: string;
  is_active: boolean;
  is_restricted?: boolean;
  name: string;
  type: string;
  volume_percent?: number;
};

export async function getDevices(): Promise<ConnectDevice[]> {
  const r = await fetch('/api/playback/devices', { credentials: 'include' });
  if (!r.ok) throw new Error(`devices ${r.status}`);
  const data = await r.json();
  return data.devices || [];
}

export async function transfer(deviceId: string, play = true): Promise<void> {
  const r = await fetch('/api/playback/transfer', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ deviceId, play })
  });
  if (!r.ok) throw new Error('transfer_failed');
}

export async function playOnDevice(opts: { deviceId: string; trackId?: string; uri?: string; uris?: string[]; positionMs?: number }): Promise<void> {
  const r = await fetch('/api/playback/play', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(opts)
  });
  if (!r.ok) throw new Error('play_failed');
}

export async function pause(deviceId?: string): Promise<void> {
  const r = await fetch('/api/playback/pause', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ deviceId })
  });
  if (!r.ok) throw new Error('pause_failed');
}

export async function next(deviceId?: string): Promise<void> {
  const r = await fetch('/api/playback/next', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ deviceId })
  });
  if (!r.ok) throw new Error('next_failed');
}

export async function seek(deviceId: string, positionMs: number): Promise<void> {
  const r = await fetch('/api/playback/seek', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ deviceId, positionMs })
  });
  if (!r.ok) throw new Error('seek_failed');
}

