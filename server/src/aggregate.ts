import { lobby } from './lobby.js';
import { store } from './store.js';
import { getTopTracks, getRecentlyPlayed, getSavedTracks, type SimpleTrack } from './spotify.js';
import { weightedSample } from './utils/random.js';

export type Aggregated = { tracks: SimpleTrack[]; byUser: Record<string, string[]> };

export async function aggregateGroup(group: string, targetCount = 100, seed?: number): Promise<Aggregated> {
  const members = lobby.members(group);
  const byUser: Record<string, string[]> = {};
  const weight = new Map<string, number>();

  for (const uid of members) {
    const tokens = store.getTokens(uid);
    if (!tokens) continue;
    const accessToken = tokens.access_token;

    // Top tracks across ranges with descending weights
    const [shortTerm, mediumTerm, longTerm] = await Promise.all([
      getTopTracks({ accessToken, time_range: 'short_term' }),
      getTopTracks({ accessToken, time_range: 'medium_term' }),
      getTopTracks({ accessToken, time_range: 'long_term' })
    ]);
    const addRanked = (list: SimpleTrack[], factor: number) =>
      list.forEach((t, idx) => {
        const w = (list.length - idx) * factor;
        weight.set(t.id, (weight.get(t.id) || 0) + w);
      });
    addRanked(shortTerm, 3);
    addRanked(mediumTerm, 2);
    addRanked(longTerm, 1);

    // Recently played (most recent higher)
    try {
      const recent = await getRecentlyPlayed({ accessToken, limit: 50 });
      recent.items.forEach((item, idx) => {
        const w = (recent.items.length - idx) * 1.5; // mild boost
        weight.set(item.track.id, (weight.get(item.track.id) || 0) + w);
      });
    } catch {}

    // Saved tracks (liked songs) - prioritize more recently added
    try {
      const saved1 = await getSavedTracks({ accessToken, limit: 50, offset: 0 });
      const saved2 = await getSavedTracks({ accessToken, limit: 50, offset: 50 });
      const saved = [...saved1.items, ...saved2.items];
      saved.forEach((item, idx) => {
        const w = (saved.length - idx) * 1.2;
        weight.set(item.track.id, (weight.get(item.track.id) || 0) + w);
      });
    } catch {}

    // Track provenance per user (optional, keep IDs only)
    byUser[uid] = Array.from(new Set([
      ...shortTerm.map(t => t.id),
      ...mediumTerm.map(t => t.id),
      ...longTerm.map(t => t.id)
    ]));
  }

  let idsSorted: string[];
  if (seed !== undefined) {
    idsSorted = weightedSample(weight, targetCount, seed);
  } else {
    idsSorted = Array.from(weight.entries()).sort((a, b) => b[1] - a[1]).map(([id]) => id);
    if (idsSorted.length > targetCount) idsSorted = idsSorted.slice(0, targetCount);
  }
  // We don’t fetch full track objects here; callers can fetch when needed
  // but for convenience we can return just ids in byUser; tracks will be fetched in game.
  return { tracks: idsSorted.map((id) => ({ id } as any)), byUser } as any;
}
