import React from 'react';
import { Card } from './Card';
import { GradientButton } from './GradientButton';

interface User {
  id: string;
  name: string;
  avatar?: string;
  role: 'host' | 'player';
}

interface GameMember {
  id: string;
  role: 'host' | 'player';
  name: string;
  avatar?: string;
}

interface HostControlsProps {
  user?: User;
  group: string;
  members?: GameMember[];
  onStartGame: () => void;
  onPause: () => void;
  onNextTrack: () => void;
  index?: number;
  total?: number;
  positionMs?: number;
  durationMs?: number;
  isPaused?: boolean;
  gameTimer?: number;
}

export function HostControls({ user, group, members, onStartGame, onPause, onNextTrack, index, total, positionMs, durationMs, isPaused, gameTimer }: HostControlsProps) {
  const fmt = (ms?: number) => {
    if (!ms && ms !== 0) return '—';
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const fmtTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Check if the host has actually joined the game
  const hostHasJoined = user && members?.some(m => m.id === user.id || m.id === `${user.id}#participant`);
  const controlsDisabled = !user || !group.trim() || !hostHasJoined;

  return (
    <Card title="Host Controls" icon="🎮" className="mb-6">
      {!hostHasJoined && user && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm px-3 py-2 rounded mb-4">
          ⚠️ Host must join the game first by selecting music preferences above.
        </div>
      )}
      <div className="flex gap-3 flex-wrap items-center">
        <GradientButton
          icon="🚀"
          disabled={controlsDisabled}
          onClick={onStartGame}
        >
          Start Game
        </GradientButton>
        <GradientButton
          icon={isPaused ? "▶️" : "⏸️"}
          disabled={controlsDisabled}
          onClick={onPause}
        >
          {isPaused ? "Resume" : "Pause"}
        </GradientButton>
        <GradientButton
          variant="blue"
          icon="⏭️"
          disabled={controlsDisabled}
          onClick={onNextTrack}
        >
          Next Track
        </GradientButton>
        {typeof gameTimer === 'number' && (
          <div className="text-slate-300 text-sm ml-2 flex items-center gap-2">
            <span className="text-lg">⏱️</span>
            <span>Track Time: <strong className="text-white">{fmtTimer(gameTimer)}</strong></span>
            {isPaused && <span className="text-yellow-400">(Paused)</span>}
          </div>
        )}
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
