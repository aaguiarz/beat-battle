import React from 'react';
import { GradientButton } from './GradientButton';
import { SongCard } from './SongCard';

interface User {
  id: string;
  name: string;
  avatar?: string;
  role: 'host' | 'player';
}

interface Track {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  duration_ms: number;
  album?: {
    name: string;
    images: Array<{ url: string }>;
  };
  external_urls?: {
    spotify: string;
  };
}

interface GameState {
  track?: Track;
}

interface Answer {
  title: string;
  artist: string;
  year: string;
}

interface Judgement {
  titleOk: boolean;
  artistOk: boolean;
  yearOk: boolean;
}

interface RevealJudgeProps {
  user?: User;
  group: string;
  state?: GameState;
  answer?: Answer;
  judgement: Judgement;
  lastPoints: number | null;
  revealError?: string;
  onReveal: () => void;
  onJudgementChange: (judgement: Judgement) => void;
}

export function RevealJudge({
  user,
  group,
  state,
  answer,
  judgement,
  lastPoints,
  revealError,
  onReveal,
  onJudgementChange
}: RevealJudgeProps) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6 shadow-xl">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <span className="text-2xl mr-2">📋</span>
        Reveal & Judge
      </h3>

      <div className="space-y-4">
        <div className="flex justify-center">
          <GradientButton
            variant="purple"
            size="lg"
            icon="🔍"
            disabled={!user || !group.trim() || !state?.track?.id}
            onClick={onReveal}
          >
            Reveal Answer
          </GradientButton>
        </div>

        {answer && state?.track && (
          <div className="">
            <SongCard track={state.track} answer={answer} />
          </div>
        )}

        {/* Hidden for now - judging checkboxes section
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-600 hover:border-green-500/50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={judgement.titleOk}
              onChange={(e) => onJudgementChange({ ...judgement, titleOk: e.target.checked })}
              className="w-4 h-4 text-green-500 bg-slate-700 border-slate-500 rounded focus:ring-green-500 focus:ring-2"
            />
            <span className="text-white flex items-center gap-2">
              <span className="text-lg">🎵</span>
              <div>
                <div className="font-medium">Title correct</div>
                <div className="text-xs text-slate-400">+1 point</div>
              </div>
            </span>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-600 hover:border-blue-500/50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={judgement.artistOk}
              onChange={(e) => onJudgementChange({ ...judgement, artistOk: e.target.checked })}
              className="w-4 h-4 text-blue-500 bg-slate-700 border-slate-500 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-white flex items-center gap-2">
              <span className="text-lg">🎤</span>
              <div>
                <div className="font-medium">Artist correct</div>
                <div className="text-xs text-slate-400">+1 point</div>
              </div>
            </span>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-600 hover:border-purple-500/50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={judgement.yearOk}
              onChange={(e) => onJudgementChange({ ...judgement, yearOk: e.target.checked })}
              className="w-4 h-4 text-purple-500 bg-slate-700 border-slate-500 rounded focus:ring-purple-500 focus:ring-2"
            />
            <span className="text-white flex items-center gap-2">
              <span className="text-lg">📅</span>
              <div>
                <div className="font-medium">Year correct</div>
                <div className="text-xs text-slate-400">+5 points</div>
              </div>
            </span>
          </label>
        </div>
        */}
      </div>
      {revealError && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            {revealError}
          </div>
        </div>
      )}
      {/* Hidden for now - points awarded section
      {lastPoints !== null && (
        <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
          <div className="text-green-400 font-semibold flex items-center justify-center gap-2">
            <span className="text-lg">🎆</span>
            Awarded: <strong className="text-white text-lg">{lastPoints}</strong> point{lastPoints === 1 ? '' : 's'}
          </div>
        </div>
      )}
      */}
    </div>
  );
}
