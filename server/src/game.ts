import { aggregateGroup, type TrackAttribution } from './aggregate.js';
import { getTracksByIds, type SimpleTrack } from './spotify.js';

type Game = {
  group: string;
  trackIds: string[];
  current: number; // index into trackIds
  scores: Map<string, number>; // userId -> points
  attributions: Record<string, TrackAttribution>; // trackId -> attribution
  lastAnswer?: { title: string; artist: string; year: number; trackId: string; attribution?: TrackAttribution };
};

const games = new Map<string, Game>();

function yearFromRelease(release: string): number | undefined {
  const m = /^(\d{4})/.exec(release);
  return m ? Number(m[1]) : undefined;
}

async function getIndexAndTrack(accessToken: string, ids: string[], index: number): Promise<{ idx: number; track?: SimpleTrack }>{
  if (!ids.length) return { idx: 0 };
  const len = ids.length;
  for (let off = 0; off < len; off++) {
    const idx = ((index + off) % len + len) % len;
    const [t] = await getTracksByIds(accessToken, [ids[idx]]);
    if (t) return { idx, track: t };
  }
  return { idx: 0 };
}

export async function startGame(opts: { group: string; accessToken: string; seed?: number }): Promise<{ track?: Pick<SimpleTrack, 'id' | 'preview_url' | 'album' | 'duration_ms'> } & { index: number; total: number }>{
  const { group, accessToken, seed } = opts;
  let game = games.get(group);
  if (!game) {
    const agg = await aggregateGroup(group, 120, seed);
    const ids = agg.tracks.map((t) => t.id).filter(Boolean).slice(0, 100);
    console.log(`[Game Debug] Aggregation returned ${agg.tracks.length} tracks, filtered to ${ids.length} IDs`);
    console.log(`[Game Debug] User contribution:`, Object.keys(agg.byUser).map(uid => `${uid}: ${agg.byUser[uid].length} tracks`));
    game = { group, trackIds: ids, current: 0, scores: new Map(), attributions: agg.attributions, lastAnswer: undefined };
    games.set(group, game);
  }
  if (!game.trackIds.length) {
    console.log(`[Game Debug] No tracks found for group ${group}. Game state:`, { trackIds: game.trackIds, members: require('./lobby').lobby.members(group) });
    throw new Error('No tracks available for this game - check that users have authenticated and have music preferences set');
  }
  const got = await getIndexAndTrack(accessToken, game.trackIds, game.current);
  game.current = got.idx;
  const t = got.track;
  const contrib = computeContrib(game);
  return { track: t ? { id: t.id, preview_url: t.preview_url, album: t.album, duration_ms: t.duration_ms } : undefined, index: game.current, total: game.trackIds.length, contrib, answer: game.lastAnswer } as any;
}

export async function getState(opts: { group: string; accessToken: string }) {
  const { group, accessToken } = opts;
  const game = games.get(group);
  if (!game) return { group, index: 0, total: 0 };
  if (!game.trackIds.length) return { group, index: 0, total: 0 };
  const got = await getIndexAndTrack(accessToken, game.trackIds, game.current);
  game.current = got.idx;
  const t = got.track;
  if (!t) {
    console.log(`[Game State] No track available for group ${group}, index ${got.idx}`);
    return { group, index: game.current, total: game.trackIds.length };
  }
  const contrib = computeContrib(game);
  return { group, index: game.current, total: game.trackIds.length, track: { id: t.id, preview_url: t.preview_url, album: t.album, duration_ms: t.duration_ms }, contrib, answer: game.lastAnswer } as any;
}

export async function submitGuess(opts: { group: string; accessToken: string; userId: string; guess: { title?: string; artist?: string; year?: number } }) {
  const { group, accessToken, userId, guess } = opts;
  const game = games.get(group);
  if (!game) throw new Error('Game not started');
  const [t] = await getTracksByIds(accessToken, [game.trackIds[game.current]]);
  const title = t.name;
  const artist = t.artists[0]?.name || '';
  const year = yearFromRelease(t.album.release_date) || 0;
  const { scoreGuess } = await import('./modules/scoring');
  const points = scoreGuess(guess, { title, artist, year });
  game.scores.set(userId, (game.scores.get(userId) || 0) + points);
  return { points, correct: { titleArtist: points >= 1, year: guess.year === year }, answer: { title, artist, year }, trackId: t.id };
}

export async function nextTrack(opts: { group: string; accessToken: string }): Promise<{ index: number; total: number; track?: Pick<SimpleTrack, 'id' | 'preview_url' | 'album' | 'duration_ms'> }> {
  const { group, accessToken } = opts;
  const game = games.get(group);
  if (!game) throw new Error('Game not started');
  if (!game.trackIds.length) throw new Error('No tracks available for this game');
  const start = (game.current + 1) % game.trackIds.length;
  const got = await getIndexAndTrack(accessToken, game.trackIds, start);
  game.current = got.idx;
  // Clear revealed answer on track advance
  game.lastAnswer = undefined;
  const t = got.track;
  const contrib = computeContrib(game);
  return { index: game.current, total: game.trackIds.length, track: t ? { id: t.id, preview_url: t.preview_url, album: t.album, duration_ms: t.duration_ms } : undefined, contrib, answer: game.lastAnswer } as any;
}

export async function prevTrack(opts: { group: string; accessToken: string }): Promise<{ index: number; total: number; track?: Pick<SimpleTrack, 'id' | 'preview_url' | 'album' | 'duration_ms'> }> {
  const { group, accessToken } = opts;
  const game = games.get(group);
  if (!game) throw new Error('Game not started');
  if (!game.trackIds.length) throw new Error('No tracks available for this game');
  const start = (game.current - 1 + game.trackIds.length) % game.trackIds.length;
  const got = await getIndexAndTrack(accessToken, game.trackIds, start);
  game.current = got.idx;
  const t = got.track;
  return { index: game.current, total: game.trackIds.length, track: t ? { id: t.id, preview_url: t.preview_url, album: t.album, duration_ms: t.duration_ms } : undefined };
}

export async function getAnswer(opts: { group: string; accessToken: string }) {
  const { group, accessToken } = opts;
  const game = games.get(group);
  if (!game) throw new Error('Game not started');
  const [t] = await getTracksByIds(accessToken, [game.trackIds[game.current]]);
  const title = t.name;
  const artist = t.artists[0]?.name || '';
  const year = yearFromRelease(t.album.release_date) || 0;
  const attribution = game.attributions[t.id];
  game.lastAnswer = { title, artist, year, trackId: t.id, attribution };
  return game.lastAnswer;
}

export function judge(opts: { group: string; userId: string; titleOk: boolean; artistOk: boolean; yearOk: boolean }) {
  const { group, userId, titleOk, artistOk, yearOk } = opts;
  const game = games.get(group);
  if (!game) throw new Error('Game not started');
  const points = (titleOk ? 1 : 0) + (artistOk ? 1 : 0) + (yearOk ? 5 : 0);
  game.scores.set(userId, (game.scores.get(userId) || 0) + points);
  return { points };
}

export function getScores(group: string) {
  const game = games.get(group);
  if (!game) return {} as Record<string, number>;
  return Object.fromEntries(game.scores.entries());
}

function computeContrib(game: Game): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of game.trackIds) {
    const attrib = game.attributions[id];
    if (!attrib || !attrib.sources.length) continue;
    const primary = attrib.sources[0].userId;
    counts[primary] = (counts[primary] || 0) + 1;
  }
  return counts;
}
