const groups = new Map<string, Set<string>>();
const hosts = new Map<string, string>(); // group -> hostUserId

export const lobby = {
  join(group: string, userId: string) {
    if (!groups.has(group)) groups.set(group, new Set());
    groups.get(group)!.add(userId);
  },
  setHost(group: string, userId: string) {
    if (!hosts.has(group)) hosts.set(group, userId);
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
  }
};
