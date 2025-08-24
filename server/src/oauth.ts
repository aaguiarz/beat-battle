export function buildSpotifyAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state?: string;
  scopes?: string[];
}): string {
  const { clientId, redirectUri, state = 'mm', scopes = [] } = opts;
  if (!clientId) throw new Error('Missing SPOTIFY_CLIENT_ID');
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export type SpotifyTokens = {
  access_token: string;
  token_type: 'Bearer' | string;
  expires_in: number; // seconds
  refresh_token?: string;
  scope?: string;
  obtained_at: number; // ms epoch when received
};

export async function exchangeCodeForToken(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<SpotifyTokens> {
  const { clientId, clientSecret, code, redirectUri } = input;
  if (!clientId || !clientSecret) throw new Error('Missing Spotify client credentials');
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri
  });
  const url = 'https://accounts.spotify.com/api/token';
  let lastErr: string | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'beat-battle/0.0.1'
      },
      body
    });
    if (resp.ok) {
      const data = (await resp.json()) as Omit<SpotifyTokens, 'obtained_at'>;
      return { ...data, obtained_at: Date.now() } as SpotifyTokens;
    }
    // Try to parse JSON error, fallback to text
    let detail = '';
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        const j = await resp.json();
        detail = JSON.stringify(j);
      } catch {
        detail = await resp.text();
      }
    } else {
      detail = await resp.text();
    }
    lastErr = `Token exchange failed: ${resp.status} ${detail}`;
    // Retry on transient upstream errors
    if ([502, 503, 504].includes(resp.status)) {
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
      continue;
    }
    break;
  }
  throw new Error(lastErr || 'Token exchange failed');
}

export async function getMe(accessToken: string): Promise<{ id: string; display_name?: string; email?: string; images?: Array<{ url: string }> }>{
  const resp = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to fetch profile: ${resp.status} ${text}`);
  }
  return (await resp.json()) as any;
}
