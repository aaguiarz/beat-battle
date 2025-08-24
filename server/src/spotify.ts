type FetchOptions = { accessToken: string };

async function fetchSpotify<T>(url: string, { accessToken }: FetchOptions, shouldLog = true): Promise<T> {
  if (shouldLog && process.env.LOG_SPOTIFY_API_CALLS?.toLowerCase() === 'true') {
    console.log(`[Spotify API] GET ${url}`);
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const text = await res.text();
    if (shouldLog && process.env.LOG_SPOTIFY_API_CALLS?.toLowerCase() === 'true') {
      console.log(`[Spotify API] ERROR ${res.status}: ${text}`);
    }
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

export type SimplePlaylist = {
  id: string;
  name: string;
  description: string | null;
  tracks: { total: number };
  images: { url: string; width: number; height: number }[];
  owner: { display_name: string; id: string };
};

export async function getUserPlaylists(opts: { accessToken: string; limit?: number; offset?: number }) {
  const { accessToken, limit = 50, offset = 0 } = opts;
  const url = new URL('https://api.spotify.com/v1/me/playlists');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  return fetchSpotify<{ items: SimplePlaylist[]; total: number }>(url.toString(), { accessToken });
}

export async function getPlaylist(opts: { accessToken: string; playlistId: string }) {
  const { accessToken, playlistId } = opts;
  const url = new URL(`https://api.spotify.com/v1/playlists/${playlistId}`);
  url.searchParams.set('fields', 'id,name,description');
  return fetchSpotify<{ id: string; name: string; description?: string }>(url.toString(), { accessToken });
}

export async function getPlaylistTracks(opts: { accessToken: string; playlistId: string; limit?: number; offset?: number }) {
  const { accessToken, playlistId, limit = 50, offset = 0 } = opts;
  const url = new URL(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  return fetchSpotify<{ items: { added_at: string; track: SimpleTrack | null }[]; total: number }>(url.toString(), { accessToken });
}

// Audio analysis for clean clip boundaries
// Audio analysis helpers removed: we start at 0ms by configuration
