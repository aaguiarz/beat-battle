import React from 'react';

interface DeviceInfo {
  name: string;
  is_active: boolean;
}

interface GameState {
  index?: number;
  total?: number;
}

interface PlaybackStatusProps {
  deviceInfo?: DeviceInfo;
  state?: GameState;
  navError?: string;
  audioRef: React.RefObject<HTMLAudioElement>;
}

export function PlaybackStatus({ deviceInfo, state, navError, audioRef }: PlaybackStatusProps) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6 shadow-xl">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <span className="text-2xl mr-2">🎵</span>
        Playback Status
      </h3>
      <audio ref={audioRef} controls className="hidden" />
      <div className="space-y-2">
        <div className="text-sm text-slate-300 flex items-center gap-2">
          <span className="text-lg">🎧</span>
          Playing via Spotify Web Playback SDK (requires Premium)
        </div>
        <div className={`text-sm flex items-center gap-2 ${deviceInfo?.is_active ? 'text-green-400' : 'text-red-400'}`}>
          <span>{deviceInfo?.is_active ? '✅' : '❌'}</span>
          Device: <strong>{deviceInfo?.name || 'Web Player'}</strong> — {deviceInfo?.is_active ? 'active' : 'inactive'}
        </div>
        {state?.index !== undefined && state?.total !== undefined && (
          <div className="text-sm text-slate-300 flex items-center gap-2">
            <span className="text-lg">📊</span>
            Track <strong>{state.index + 1}</strong> of <strong>{state.total}</strong>
          </div>
        )}
        {navError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
            <span className="text-lg mr-2">⚠️</span>
            {navError}
          </div>
        )}
      </div>
    </div>
  );
}