import React from 'react';

interface LoginPromptProps {
  loginUrl: string;
}

export function LoginPrompt({ loginUrl }: LoginPromptProps) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-6 shadow-xl">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <span className="text-2xl mr-2">🎧</span>
        Spotify Connection Required
      </h3>
      <div className="text-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
          <p className="text-red-400 flex items-center justify-center gap-2">
            <span>❌</span>
            Not connected to Spotify
          </p>
        </div>
        <a href={loginUrl}>
          <button className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-green-500/25">
            🚀 Connect with Spotify
          </button>
        </a>
      </div>
    </div>
  );
}