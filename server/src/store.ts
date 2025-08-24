import type { SpotifyTokens } from './oauth';

const tokensByUser = new Map<string, SpotifyTokens>();
const namesByUser = new Map<string, string>();
const avatarsByUser = new Map<string, string>();

export const store = {
  saveUser(userId: string, name: string, tokens: SpotifyTokens, avatarUrl?: string) {
    console.log(`[Store Debug] Saving user: ${userId}, name: ${name}`);
    namesByUser.set(userId, name);
    tokensByUser.set(userId, tokens);
    if (avatarUrl) avatarsByUser.set(userId, avatarUrl);
  },
  getTokens(userId: string): SpotifyTokens | undefined {
    const tokens = tokensByUser.get(userId);
    console.log(`[Store Debug] Getting tokens for ${userId}: ${!!tokens ? 'found' : 'NOT FOUND'}`);
    return tokens;
  },
  getName(userId: string): string | undefined {
    return namesByUser.get(userId);
  },
  getAvatar(userId: string): string | undefined {
    return avatarsByUser.get(userId);
  },
  getAllStoredUsers(): string[] {
    return Array.from(tokensByUser.keys());
  }
};
