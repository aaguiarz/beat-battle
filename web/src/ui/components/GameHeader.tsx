import React from 'react';
import { UserSection } from './UserSection';

interface User {
  id: string;
  name: string;
  avatar?: string;
  role: 'host' | 'player';
}

interface GameHeaderProps {
  user?: User;
  onLogout: () => void;
}

export function GameHeader({ user, onLogout }: GameHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start mb-8 gap-4">
      <div className="text-center lg:flex-1 order-1 lg:order-1">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
          🎵 Beat Battle
        </h1>
      </div>

      {user && (
        <div className="order-2 lg:order-2">
          <UserSection user={user} onLogout={onLogout} />
        </div>
      )}
    </div>
  );
}