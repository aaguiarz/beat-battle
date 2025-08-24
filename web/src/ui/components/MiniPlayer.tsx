import React from 'react';

interface SDKState {
  paused?: boolean;
  position?: number;
  duration?: number;
}

interface Track {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  duration_ms: number;
}

interface GameState {
  track?: Track;
}

interface MiniPlayerProps {
  sdkState?: SDKState;
  state?: GameState;
  volume: number;
  onPrevTrack: () => void;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onVolumeChange: (volume: number) => void;
  formatDuration: (ms?: number) => string;
}

export function MiniPlayer({
  sdkState,
  state,
  volume,
  onPrevTrack,
  onTogglePlay,
  onNextTrack,
  onVolumeChange,
  formatDuration
}: MiniPlayerProps) {
  return (
    <div className="fixed left-0 right-0 bottom-0 bg-slate-900 text-white px-3 py-2 flex items-center gap-3 border-t border-slate-700 shadow-2xl">
      <button
        onClick={onPrevTrack}
        className="bg-slate-800 hover:bg-slate-700 text-white border-0 px-2.5 py-1.5 rounded transition-colors"
      >
        ⏮
      </button>
      <button
        onClick={onTogglePlay}
        className="bg-green-500 hover:bg-green-400 text-black border-0 px-2.5 py-1.5 rounded transition-colors font-medium"
      >
        {sdkState?.paused ? 'Play' : 'Pause'}
      </button>
      <button
        onClick={onNextTrack}
        className="bg-slate-800 hover:bg-slate-700 text-white border-0 px-2.5 py-1.5 rounded transition-colors"
      >
        ⏭
      </button>
      <div className="flex items-center gap-1.5">
        <span className="text-xs opacity-80">Vol</span>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="w-20"
        />
      </div>
      <div className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">
        <span className="text-sm">{sdkState ? 'Now Playing' : 'Ready'}</span>
      </div>
      <div className="tabular-nums text-sm">
        {formatDuration(sdkState?.position || 0)} / {formatDuration(sdkState?.duration || state?.track?.duration_ms)}
      </div>
    </div>
  );
}