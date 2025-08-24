import React from 'react';
import { Card } from './Card';
import { GradientButton } from './GradientButton';

interface User {
  id: string;
  name: string;
  avatar?: string;
  role: 'host' | 'player';
}

interface HostControlsProps {
  user?: User;
  group: string;
  onStartGame: () => void;
  onNextTrack: () => void;
}

export function HostControls({ user, group, onStartGame, onNextTrack }: HostControlsProps) {
  return (
    <Card title="Host Controls" icon="🎮" className="mb-6">
      <div className="flex gap-3 flex-wrap">
        <GradientButton
          icon="🚀"
          disabled={!user || !group.trim()}
          onClick={onStartGame}
        >
          Start Game
        </GradientButton>
        <GradientButton
          variant="blue"
          icon="⏭️"
          disabled={!user || !group.trim()}
          onClick={onNextTrack}
        >
          Next Track
        </GradientButton>
      </div>
    </Card>
  );
}