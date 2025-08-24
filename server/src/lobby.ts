const groups = new Map<string, Set<string>>();
const hosts = new Map<string, string>(); // group -> hostUserId

export type SongPreference = {
  includeLiked: boolean;
  includeRecent: boolean;
  includePlaylist: boolean;
  playlistId?: string; // required when includePlaylist is true
};

const userPreferences = new Map<string, Map<string, SongPreference>>(); // group -> userId -> preference

export const lobby = {
  join(group: string, userId: string) {
    if (!groups.has(group)) groups.set(group, new Set());
    groups.get(group)!.add(userId);
  },
  setHost(group: string, userId: string) {
    // Only set host if group doesn't already have one (first come, first serve)
    if (!hosts.has(group)) {
      hosts.set(group, userId);
      console.log(`[Lobby] Setting ${userId} as host for group ${group}`);
    } else {
      console.log(`[Lobby] Group ${group} already has host ${hosts.get(group)}, not changing to ${userId}`);
    }
  },
  getHost(group: string): string | undefined {
    return hosts.get(group);
  },
  members(group: string): string[] {
    return Array.from(groups.get(group) || []);
  },
  membersDetailed(group: string): Array<{ id: string; role: 'host' | 'player' }> {
    const list = Array.from(groups.get(group) || []);
    const host = hosts.get(group);
    return list.map((id) => ({ id, role: id === host ? 'host' : 'player' }));
  },
  setUserPreference(group: string, userId: string, preference: SongPreference) {
    if (!userPreferences.has(group)) {
      userPreferences.set(group, new Map());
    }
    userPreferences.get(group)!.set(userId, preference);
  },
  getUserPreference(group: string, userId: string): SongPreference | undefined {
    return userPreferences.get(group)?.get(userId);
  },
  getAllUserPreferences(group: string): Map<string, SongPreference> {
    return userPreferences.get(group) || new Map();
  },
  clearGroup(group: string) {
    // For testing/debugging purposes
    groups.delete(group);
    hosts.delete(group);
    userPreferences.delete(group);
    console.log(`[Lobby] Cleared all data for group ${group}`);
  }
};
