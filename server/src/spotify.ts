type FetchOptions = { accessToken: string };

async function fetchSpotify<T>(url: string, { accessToken }: FetchOptions): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify API ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export type SimpleTrack = {
  id: string;
  name: string;
  album: { release_date: string; name?: string; images?: { url: string; width: number; height: number }[] };
  artists: { name: string }[];
  preview_url: string | null;
  duration_ms: number;
};

export async function getTopTracks(opts: { accessToken: string; limit?: number; time_range?: 'short_term' | 'medium_term' | 'long_term' }) {
  const { accessToken, limit = 50, time_range = 'medium_term' } = opts;
  const url = new URL('https://api.spotify.com/v1/me/top/tracks');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('time_range', time_range);
  const data = await fetchSpotify<{ items: SimpleTrack[] }>(url.toString(), { accessToken });
  return data.items;
}

export async function getTracksByIds(accessToken: string, ids: string[]) {
  const url = new URL('https://api.spotify.com/v1/tracks');
  url.searchParams.set('ids', ids.join(','));
  const data = await fetchSpotify<{ tracks: SimpleTrack[] }>(url.toString(), { accessToken });
  return data.tracks;
}

export async function getRecentlyPlayed(opts: { accessToken: string; limit?: number }) {
  const { accessToken, limit = 50 } = opts;
  const url = new URL('https://api.spotify.com/v1/me/player/recently-played');
  url.searchParams.set('limit', String(limit));
  return fetchSpotify<{ items: { track: SimpleTrack; played_at: string }[] }>(url.toString(), { accessToken });
}

export async function getSavedTracks(opts: { accessToken: string; limit?: number; offset?: number }) {
  const { accessToken, limit = 50, offset = 0 } = opts;
  const url = new URL('https://api.spotify.com/v1/me/tracks');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  return fetchSpotify<{ items: { added_at: string; track: SimpleTrack }[]; total: number }>(url.toString(), { accessToken });
}
