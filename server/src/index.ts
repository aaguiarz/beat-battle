import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieSession from 'cookie-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { buildSpotifyAuthUrl, exchangeCodeForToken, getMe } from './oauth.js';
import { scoreGuess } from './modules/scoring.js';
import { lobby, type SongPreference } from './lobby.js';
import { store } from './store.js';
import { getUserPlaylists, getSavedTracks, getRecentlyPlayed } from './spotify.js';
import { startGame, getState as getGameState, submitGuess, nextTrack, prevTrack, getScores, getAnswer, judge } from './game.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 4000);
// Auto-detect Railway environment
const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production';
const BASE_URL = process.env.BASE_URL || (isRailway ? 'https://spot-the-track-production.up.railway.app' : `http://127.0.0.1:${PORT}`);
const WEB_URL = process.env.WEB_URL || (isRailway ? 'https://spot-the-track-production.up.railway.app' : 'http://127.0.0.1:5173');
const ALLOW_HOST_AS_PARTICIPANT = String(process.env.ALLOW_HOST_AS_PARTICIPANT || '').toLowerCase() === 'true';
const LOG_SPOTIFY_API_CALLS = String(process.env.LOG_SPOTIFY_API_CALLS || 'true').toLowerCase() === 'true';

function isValidGroup(g?: string): g is string {
  return !!g && /^[A-Za-z0-9]{12}$/.test(g);
}

const app = express();

// Trust Railway proxy for secure cookies
if (isRailway) {
  app.set('trust proxy', 1);
}

// Add error handling
app.on('error', (err) => {
  console.error('Express app error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

app.use(cors({ 
  origin: WEB_URL,
  credentials: true 
}));
app.use(express.json());
app.use(
  cookieSession({
    name: 'mm',
    keys: [process.env.SESSION_SECRET || 'dev-secret'],
    sameSite: 'lax',
    httpOnly: true,
    secure: true, // Always secure since we trust proxy in Railway
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
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
  const state = req.query.state?.toString() || 'mm';
  const isHost = req.query.host === 'true';

  // Base scopes for all users (no Premium required)
  const baseScopes = [
    'user-top-read',
    'user-read-recently-played',
    'user-library-read',
    'user-read-email',
    'user-read-private',
    'playlist-read-private',
    'playlist-read-collaborative'
  ];

  // Premium-only scopes for hosts
  const hostScopes = [
    'streaming',
    'user-modify-playback-state',
    'user-read-playback-state',
    'user-read-currently-playing'
  ];

  const scopes = isHost ? [...baseScopes, ...hostScopes] : baseScopes;

  const url = buildSpotifyAuthUrl({
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || `${BASE_URL}/auth/callback`,
    state,
    scopes
  });
  res.redirect(url);
});

// OAuth callback placeholder (exchange code for tokens in a real impl.)
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  console.log('[OAuth] Callback started - Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[OAuth] Session before:', req.session);
  if (!code || typeof code !== 'string') return res.status(400).send('Missing code');
  try {
    console.log('[OAuth] Starting callback processing...');
    const tokens = await exchangeCodeForToken({
      clientId: process.env.SPOTIFY_CLIENT_ID || '',
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
      redirectUri: process.env.SPOTIFY_REDIRECT_URI || `${BASE_URL}/auth/callback`,
      code
    });
    const me = await getMe(tokens.access_token);
    console.log('[OAuth] Got user info:', me.id);
    
    if (req.session) {
      req.session.tokens = tokens;
      req.session.user = { id: me.id, display_name: me.display_name || me.id };
      console.log('[OAuth] Session set successfully - Session after:', req.session);
    } else {
      console.error('[OAuth] No session available!');
    }
    
    const avatar = me.images?.[0]?.url;
    store.saveUser(me.id, me.display_name || me.id, tokens, avatar);

    // Handle different authentication intents
    let redirectUrl = WEB_URL.replace(/\/$/, '');
    let group: string | undefined;

    if (typeof state === 'string') {
      if (state === 'create') {
        // User wants to create a new game - do it automatically
        try {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let newGroup = '';
          for (let i = 0; i < 12; i++) newGroup += chars[Math.floor(Math.random() * chars.length)];

          lobby.setHost(newGroup, me.id);
          console.log(`[OAuth Create] Auto-created game ${newGroup} for user ${me.id}`);

          if (req.session) {
            req.session.group = newGroup;
            req.session.memberId = me.id;
          }

          redirectUrl += `/game?authed=1&group=${newGroup}&created=1`;
        } catch (e) {
          console.error('[OAuth Create] Failed to auto-create game:', e);
          redirectUrl += '?authed=1&error=create_failed';
        }
      } else if (state.startsWith('join:')) {
        // User wants to join an existing game
        const grp = decodeURIComponent(state.slice('join:'.length));
        if (isValidGroup(grp)) {
          group = grp;
          if (req.session) req.session.group = group;
          console.log(`[OAuth Join] User ${me.id} authenticated to join game ${group}`);
          redirectUrl += `/game?authed=1&group=${group}&autojoin=1`;
        } else {
          console.error(`[OAuth Join] Invalid group code: ${grp}`);
          redirectUrl += '?authed=1&error=invalid_group';
        }
      } else if (state.startsWith('group:')) {
        // Legacy group handling
        const grp = decodeURIComponent(state.slice('group:'.length));
        if (isValidGroup(grp)) group = grp;
        if (req.session) req.session.group = group;
        redirectUrl += `/game?authed=1${group ? `&group=${group}` : ''}`;
      } else {
        // Default case
        redirectUrl += '?authed=1';
      }
    } else {
      redirectUrl += '?authed=1';
    }

    res.redirect(redirectUrl);
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
    console.log('[Me] Request - Session:', req.session);
    console.log('[Me] Request - Headers:', JSON.stringify(req.headers, null, 2));
    const access = req.session?.tokens?.access_token;
    if (!access) {
      console.log('[Me] No access token found in session');
      return res.status(401).json({ error: 'Not authenticated' });
    }
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
        if (host) {
          role = host === memberId || host === me.id ? 'host' : 'player';
          console.log(`[Me Debug] User ${me.id} in group ${group}: host=${host}, memberId=${memberId}, role=${role}`);
        }
      }
    }
    res.json({ id: me.id, name: me.display_name || me.id, group, memberId, role });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// Provide an access token for the Web Playback SDK
app.get('/api/token', (req, res) => {
  console.log('[Token] Request - Session:', req.session);
  console.log('[Token] Request - Headers:', JSON.stringify(req.headers, null, 2));
  const access = req.session?.tokens?.access_token;
  if (!access) {
    console.log('[Token] No access token found in session');
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ access_token: access });
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  const uid = req.session?.user?.id;
  if (uid) {
    console.log(`[Logout] User ${uid} logging out`);
    // Remove user's stored tokens and data
    // Note: We're not removing from store to avoid breaking ongoing games
    // Just clearing the session
  }

  // Clear the session
  if (req.session) {
    req.session = null;
  }

  res.json({ ok: true, message: 'Logged out successfully' });
});

// Public config for the web app
app.get('/api/config', (_req, res) => {
  res.json({ allowHostParticipant: ALLOW_HOST_AS_PARTICIPANT });
});

// Get user's playlists for selection (20 most recent)
app.get('/api/playlists', async (req, res) => {
  try {
    const access = req.session?.tokens?.access_token;
    if (!access) return res.status(401).json({ error: 'Not authenticated' });
    const data = await getUserPlaylists({ accessToken: access, limit: 20 });
    res.json({ playlists: data.items });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// Game creation endpoint
app.post('/api/game/create', (req, res) => {
  const uid = req.session?.user?.id;
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });

  // Generate a new group code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let group = '';
  for (let i = 0; i < 12; i++) group += chars[Math.floor(Math.random() * chars.length)];

  // Set the creator as the host immediately, but don't join them to the lobby yet
  // They need to select their music preferences first
  lobby.setHost(group, uid);

  if (req.session) {
    req.session.group = group;
    req.session.memberId = uid;
  }

  console.log(`[Game Create] User ${uid} created and became host of group ${group} (needs to select preferences)`);

  // Return empty members list since the host hasn't joined the lobby yet
  res.json({ ok: true, group, members: [] });
});

// Lobby endpoints
app.post('/api/lobby/join', (req, res) => {
  const uid = req.session?.user?.id;
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });

  // Check if user has tokens stored (required for aggregation)
  const tokens = store.getTokens(uid);
  if (!tokens) {
    console.log(`[Join Debug] User ${uid} trying to join but has no stored tokens`);
    return res.status(400).json({ error: 'No Spotify tokens found. Please reconnect with Spotify.' });
  }
  const group = (req.body?.group || req.session?.group) as string | undefined;
  const preference = req.body?.preference as SongPreference | undefined;
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

  // Store user song preference if provided
  if (preference && (preference.includeLiked || preference.includeRecent ||
      (preference.includePlaylist && preference.playlistId))) {
    console.log(`[Join Debug] Storing preference for user ${uid} in group ${group}:`, preference);
    lobby.setUserPreference(group, uid, preference);
    if (LOG_SPOTIFY_API_CALLS) {
      const selected = [];
      if (preference.includeLiked) selected.push('liked');
      if (preference.includeRecent) selected.push('recent');
      if (preference.includePlaylist) selected.push(`playlist: ${preference.playlistId}`);
      console.log(`[User Preference] ${uid} in group ${group} selected: ${selected.join(', ')}`);
    }
  } else {
    console.log(`[Join Debug] No valid preference provided for user ${uid} in group ${group}. Preference:`, preference);
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
  const host = lobby.getHost(group);
  const detailed = lobby.membersDetailed(group).map(m => {
    const baseId = m.id.split('#')[0];
    const name = store.getName(baseId) || baseId;
    const avatar = store.getAvatar(baseId);
    return { ...m, name, avatar };
  }).sort((a, b) => {
    if (a.role !== b.role) return a.role === 'host' ? -1 : 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
  res.json({ group, members: detailed, host });
});

// Build aggregated playlist (IDs) for the group and start game
app.post('/api/game/:group/start', async (req, res) => {
  try {
    const access = req.session?.tokens?.access_token;
    const uid = req.session?.user?.id;
    if (!access || !uid) return res.status(401).json({ error: 'Not authenticated' });
    const group = req.params.group;
    if (!isValidGroup(group)) return res.status(400).json({ error: 'Invalid group' });
    // Ensure the requester is part of the lobby and verify they are the host
    const currentHost = lobby.getHost(group);
    const members = lobby.members(group);

    if (!currentHost) {
      // If there's no host, this shouldn't happen during game start - return error
      return res.status(400).json({ error: 'No host found for this group. Someone needs to create the game first.' });
    }

    // Verify that the requester is the host
    if (currentHost !== uid) {
      return res.status(403).json({ error: 'Only the host can start the game.' });
    }

    // Make sure the host is in the members list
    if (!members.includes(uid) && !members.includes(`${uid}#participant`)) {
      lobby.join(group, uid);
    }
    if (req.session) {
      req.session.group = group;
      req.session.memberId = uid;
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

// Serve static files from the web build
const possibleWebPaths = [
  path.join(__dirname, '../../web/dist'),  // Local/monorepo structure
  path.join(__dirname, '../web/dist'),     // Alternative structure
  path.join(process.cwd(), 'web/dist'),    // From project root
];

let webDistPath: string | null = null;
for (const webPath of possibleWebPaths) {
  if (existsSync(path.join(webPath, 'index.html'))) {
    webDistPath = webPath;
    break;
  }
}

if (webDistPath) {
  console.log('Serving web app from:', webDistPath);
  
  // Serve static files
  app.use(express.static(webDistPath));
  
  // Catch-all handler for client-side routing (AFTER all API routes)
  app.get('*', (req, res) => {
    // Only serve index.html for non-API routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || req.path === '/health') {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    const indexPath = path.join(webDistPath!, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).send('Error serving application');
      }
    });
  });
} else {
  console.warn('Could not find web build directory. API-only mode.');
  console.log('Checked paths:', possibleWebPaths);
  
  // Fallback root route
  app.get('/', (req, res) => {
    res.json({
      message: 'Musica Maestro API Server',
      version: '0.0.1',
      note: 'Web app not found - serving API only'
    });
  });
}

// Temporarily disable static file serving to test API functionality
console.log('API-only mode for testing');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on ${BASE_URL}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Port: ${PORT}`);
}).on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
