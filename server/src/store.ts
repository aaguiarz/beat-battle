import type { SpotifyTokens } from './oauth.js';

const tokensByUser = new Map<string, SpotifyTokens>();
const namesByUser = new Map<string, string>();
const avatarsByUser = new Map<string, string>();

export const store = {
  saveUser(userId: string, name: string, tokens: SpotifyTokens, avatarUrl?: string) {
    namesByUser.set(userId, name);
    tokensByUser.set(userId, tokens);
    if (avatarUrl) avatarsByUser.set(userId, avatarUrl);
  },
  getTokens(userId: string): SpotifyTokens | undefined {
    return tokensByUser.get(userId);
  },
  getName(userId: string): string | undefined {
    return namesByUser.get(userId);
  },
  getAvatar(userId: string): string | undefined {
    return avatarsByUser.get(userId);
  }
};
