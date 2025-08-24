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
  onPause: () => void;
  onNextTrack: () => void;
  index?: number;
  total?: number;
  positionMs?: number;
  durationMs?: number;
}

export function HostControls({ user, group, onStartGame, onPause, onNextTrack, index, total, positionMs, durationMs }: HostControlsProps) {
  const fmt = (ms?: number) => {
    if (!ms && ms !== 0) return '—';
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  return (
    <Card title="Host Controls" icon="🎮" className="mb-6">
      <div className="flex gap-3 flex-wrap items-center">
        <GradientButton
          icon="🚀"
          disabled={!user || !group.trim()}
          onClick={onStartGame}
        >
          Start Game
        </GradientButton>
        <GradientButton
          icon="⏸️"
          disabled={!user || !group.trim()}
          onClick={onPause}
        >
          Pause
        </GradientButton>
        <GradientButton
          variant="blue"
          icon="⏭️"
          disabled={!user || !group.trim()}
          onClick={onNextTrack}
        >
          Next Track
        </GradientButton>
        {typeof index === 'number' && typeof total === 'number' && total > 0 && (
          <div className="text-slate-300 text-sm ml-2">
            Track <strong className="text-white">{index + 1}</strong> of <strong className="text-white">{total}</strong>
          </div>
        )}
        {typeof positionMs === 'number' && typeof durationMs === 'number' && durationMs > 0 && (
          <div className="text-slate-300 text-sm ml-2">
            {fmt(positionMs)}s of {fmt(durationMs)} min
          </div>
        )}
      </div>
    </Card>
  );
}
