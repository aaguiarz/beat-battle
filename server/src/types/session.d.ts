import 'cookie-session';

export type SpotifyUser = { id: string; display_name?: string };
export type SpotifyTokens = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  obtained_at: number;
};

declare module 'express-serve-static-core' {
  interface Request {
    session?: import('cookie-session').Session &
      Partial<import('cookie-session').SessionObject> & {
        tokens?: SpotifyTokens;
        user?: SpotifyUser;
        group?: string;
      };
  }
}

