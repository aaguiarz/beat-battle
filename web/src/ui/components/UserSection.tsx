import React from 'react';
import { GradientButton } from './GradientButton';

interface User {
  id: string;
  name: string;
  role?: 'host' | 'player';
}

interface UserSectionProps {
  user: User;
  onLogout: () => void;
}

export function UserSection({ user, onLogout }: UserSectionProps) {
  return (
    <div className="flex items-center justify-center lg:justify-end gap-3">
      <div className="text-center lg:text-right">
        <div className="text-green-400 text-sm font-medium flex items-center justify-center lg:justify-end gap-2">
          Connected as <strong className="text-white">{user.name}</strong>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            user.role === 'host' 
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}>
            {user.role === 'host' ? '👑 Host' : '🎮 Player'}
          </span>
        </div>
        <div className="text-slate-400 text-xs">({user.id})</div>
      </div>
      <GradientButton
        variant="red"
        size="sm"
        icon="🚪"
        onClick={onLogout}
      >
        Logout
      </GradientButton>
    </div>
  );
}