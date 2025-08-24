import React from 'react';

interface Member {
  id: string;
  name: string;
  avatar?: string;
  role: 'host' | 'player';
}

interface GameState {
  contrib?: Record<string, number>;
}

interface GameMembersListProps {
  members: Member[];
  state?: GameState;
}

export function GameMembersList({ members, state }: GameMembersListProps) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6 shadow-xl">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <span className="text-2xl mr-2">👥</span>
        Game Members ({members.length})
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-600">
            {m.avatar ? (
              <img src={m.avatar} alt={m.name} width={40} height={40} className="rounded-full object-cover border-2 border-slate-500" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white flex items-center justify-center text-sm font-bold">
                {m.name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white font-medium truncate">{m.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.role === 'host' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                  {m.role === 'host' ? '👑' : '🎮'}
                </span>
              </div>
              {state?.contrib && (
                <div className="text-xs text-slate-400">
                  {state.contrib[m.id.split('#')[0]] ?? 0} songs contributed
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}