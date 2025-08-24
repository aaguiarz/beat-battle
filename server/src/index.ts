import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieSession from 'cookie-session';
import { buildSpotifyAuthUrl, exchangeCodeForToken, getMe } from './oauth.js';
import { scoreGuess } from './modules/scoring.js';
import { lobby } from './lobby.js';
import { store } from './store.js';
import { startGame, getState as getGameState, submitGuess, nextTrack, prevTrack, getScores, getAnswer, judge } from './game.js';

const PORT = Number(process.env.PORT || 4000);
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const WEB_URL = process.env.WEB_URL || 'http://127.0.0.1:5173';
const ALLOW_HOST_AS_PARTICIPANT = String(process.env.ALLOW_HOST_AS_PARTICIPANT || '').toLowerCase() === 'true';

function isValidGroup(g?: string): g is string {
  return !!g && /^[A-Za-z0-9]{12}$/.test(g);
}

const app = express();
app.use(cors({ origin: '*'}));
app.use(express.json());
app.use(
  cookieSession({
    name: 'mm',
    keys: [process.env.SESSION_SECRET || 'dev-secret'],
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  })
);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/version', (_req, res) => {
  res.json({ name: 'musica-maestro-server', version: '0.0.1' });
});

// Build the Spotify authorization URL
app.get('/auth/login', (req, res) => {
  const url = buildSpotifyAuthUrl({
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || `${BASE_URL}/auth/callback`,
    state: req.query.state?.toString() || 'mm',
    scopes: [
      'user-top-read',
      'user-read-recently-played',
      'user-library-read',
      'streaming',
      'user-read-email',
      'user-read-private',
      'user-modify-playback-state',
      'user-read-playback-state',
      'playlist-modify-private',
      'playlist-modify-public'
    ]
  });
  res.redirect(url);
});

// OAuth callback placeholder (exchange code for tokens in a real impl.)
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || typeof code !== 'string') return res.status(400).send('Missing code');
  try {
    const tokens = await exchangeCodeForToken({
      clientId: process.env.SPOTIFY_CLIENT_ID || '',
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
      redirectUri: process.env.SPOTIFY_REDIRECT_URI || `${BASE_URL}/auth/callback`,
      code
    });
    const me = await getMe(tokens.access_token);
    if (req.session) {
      req.session.tokens = tokens;
      req.session.user = { id: me.id, display_name: me.display_name || me.id };
    }
    const avatar = me.images?.[0]?.url;
    store.saveUser(me.id, me.display_name || me.id, tokens, avatar);
  // Pass through the original group from state if present
  let group: string | undefined;
  if (typeof state === 'string' && state.startsWith('group:')) {
    const grp = decodeURIComponent(state.slice('group:'.length));
    if (isValidGroup(grp)) group = grp;
    if (req.session) req.session.group = group;
  }
    const target = new URL(WEB_URL.replace(/\/$/, '') + '/game');
    target.searchParams.set('authed', '1');
    if (group) target.searchParams.set('group', group);
    res.redirect(target.toString());
  } catch (e) {
    res.status(400).send((e as Error).message);
  }
});

// Example scoring endpoint for smoke testing logic
app.post('/api/score', (req, res) => {
  const { guess, actual } = req.body || {};
  try {
    const points = scoreGuess(guess, actual);
    res.json({ points });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// Return current user profile (minimal)
app.get('/api/me', async (req, res) => {
  try {
    const access = req.session?.tokens?.access_token;
    if (!access) return res.status(401).json({ error: 'Not authenticated' });
    const me = await getMe(access);
    const group = (req.session?.group as string | undefined) || null;
    let role: 'host' | 'player' | null = null;
    let memberId: string | null = (req.session as any)?.memberId || null;
    if (group) {
      const members = lobby.membersDetailed(group);
      const found = memberId ? members.find(m => m.id === memberId) : undefined;
      if (found) role = found.role;
      else {
        const host = lobby.getHost(group);
        if (host) role = host === me.id ? 'host' : 'player';
      }
    }
    res.json({ id: me.id, name: me.display_name || me.id, group, memberId, role });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// Provide an access token for the Web Playback SDK
app.get('/api/token', (req, res) => {
  const access = req.session?.tokens?.access_token;
  if (!access) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ access_token: access });
});

// Public config for the web app
app.get('/api/config', (_req, res) => {
  res.json({ allowHostParticipant: ALLOW_HOST_AS_PARTICIPANT });
});

// Lobby endpoints
app.post('/api/lobby/join', (req, res) => {
  const uid = req.session?.user?.id;
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });
  const group = (req.body?.group || req.session?.group) as string | undefined;
  if (!isValidGroup(group)) return res.status(400).json({ error: 'Invalid group. Use 12 alphanumeric chars.' });

  const currentHost = lobby.getHost(group);
  let memberId = uid;
  if (!currentHost) {
    // First join: set host and add host entry
    lobby.setHost(group, uid);
    lobby.join(group, uid);
  } else if (currentHost === uid) {
    // Host joining again from another browser
    if (ALLOW_HOST_AS_PARTICIPANT) {
      memberId = `${uid}#participant`;
      lobby.join(group, memberId);
    } else {
      lobby.join(group, uid);
    }
  } else {
    // Regular player
    lobby.join(group, uid);
  }

  if (req.session) {
    req.session.group = group;
    req.session.memberId = memberId;
  }
  const detailed = lobby.membersDetailed(group)
    .map(m => {
      const baseId = m.id.split('#')[0];
      const name = store.getName(baseId) || baseId;
      const avatar = store.getAvatar(baseId);
      return { ...m, name, avatar };
    })
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'host' ? -1 : 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  res.json({ ok: true, group, members: detailed });
});

app.get('/api/lobby/:group', (req, res) => {
  const group = req.params.group;
  if (!isValidGroup(group)) return res.status(400).json({ error: 'Invalid group' });
  const detailed = lobby.membersDetailed(group).map(m => {
    const baseId = m.id.split('#')[0];
    const name = store.getName(baseId) || baseId;
    const avatar = store.getAvatar(baseId);
    return { ...m, name, avatar };
  }).sort((a, b) => {
    if (a.role !== b.role) return a.role === 'host' ? -1 : 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
  res.json({ group, members: detailed });
});

// Build aggregated playlist (IDs) for the group and start game
app.post('/api/game/:group/start', async (req, res) => {
  try {
    const access = req.session?.tokens?.access_token;
    const uid = req.session?.user?.id;
    if (!access || !uid) return res.status(401).json({ error: 'Not authenticated' });
    const group = req.params.group;
    if (!isValidGroup(group)) return res.status(400).json({ error: 'Invalid group' });
    // Ensure the requester is part of the lobby so aggregation has at least one member
    lobby.join(group, uid);
    if (!lobby.getHost(group)) lobby.setHost(group, uid);
    if (req.session) {
      req.session.group = group;
      req.session.memberId = uid; // starting user is the host for this session
    }
    const seedParam = req.query.seed as string | undefined;
    const seed = seedParam ? Number(seedParam) : Date.now();
    const out = await startGame({ group, accessToken: access, seed });
    res.json({ ok: true, ...out, scores: getScores(group) });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.get('/api/game/:group/state', async (req, res) => {
  try {
    const access = req.session?.tokens?.access_token;
    if (!access) return res.status(401).json({ error: 'Not authenticated' });
    const group = req.params.group;
    if (!isValidGroup(group)) return res.status(400).json({ error: 'Invalid group' });
    const out = await getGameState({ group, accessToken: access });
    res.json({ ok: true, ...out, scores: getScores(group) });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post('/api/game/:group/guess', async (req, res) => {
  try {
    const access = req.session?.tokens?.access_token;
    const uid = req.session?.user?.id;
    if (!access || !uid) return res.status(401).json({ error: 'Not authenticated' });
    const group = req.params.group;
    if (!isValidGroup(group)) return res.status(400).json({ error: 'Invalid group' });
    const { guess } = req.body || {};
    const out = await submitGuess({ group, accessToken: access, userId: uid, guess });
    res.json({ ok: true, ...out, scores: getScores(group) });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post('/api/game/:group/next', async (req, res) => {
  try {
    const access = req.session?.tokens?.access_token;
    if (!access) return res.status(401).json({ error: 'Not authenticated' });
    const group = req.params.group;
    if (!isValidGroup(group)) return res.status(400).json({ error: 'Invalid group' });
    const out = await nextTrack({ group, accessToken: access });
    if (!out.track) return res.status(404).json({ error: 'No playable tracks found' });
    res.json({ ok: true, ...out, scores: getScores(group) });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post('/api/game/:group/prev', async (req, res) => {
  try {
    const access = req.session?.tokens?.access_token;
    if (!access) return res.status(401).json({ error: 'Not authenticated' });
    const group = req.params.group;
    const out = await prevTrack({ group, accessToken: access });
    if (!out.track) return res.status(404).json({ error: 'No playable tracks found' });
    res.json({ ok: true, ...out, scores: getScores(group) });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// Reveal the correct answer for the current track
app.get('/api/game/:group/reveal', async (req, res) => {
  try {
    const access = req.session?.tokens?.access_token;
    if (!access) return res.status(401).json({ error: 'Not authenticated' });
    const group = req.params.group;
    if (!isValidGroup(group)) return res.status(400).json({ error: 'Invalid group' });
    const ans = await getAnswer({ group, accessToken: access });
    res.json({ ok: true, answer: ans, scores: getScores(group) });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// Manually judge a round (title +1, artist +1, year +5)
app.post('/api/game/:group/judge', (req, res) => {
  try {
    const uid = req.session?.user?.id;
    if (!uid) return res.status(401).json({ error: 'Not authenticated' });
    const group = req.params.group;
    if (!isValidGroup(group)) return res.status(400).json({ error: 'Invalid group' });
    const { titleOk, artistOk, yearOk } = req.body || {};
    const out = judge({ group, userId: uid, titleOk: !!titleOk, artistOk: !!artistOk, yearOk: !!yearOk });
    res.json({ ok: true, ...out, scores: getScores(group) });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on ${BASE_URL}`);
});
