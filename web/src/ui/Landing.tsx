import React, { useState } from 'react';

function isValidGroupName(s: string) {
  return /^[A-Za-z0-9]{12}$/.test(s);
}

export function Landing() {
  const [joinCode, setJoinCode] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent mb-6">
              🎵 Beat Battle
            </h1>
            <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto">
              A party game powered by Spotify: create a shared playlist from everyone's tastes,
              play songs, and score points by identifying the <span className="text-green-400 font-semibold">Title (+1)</span>, <span className="text-blue-400 font-semibold">Artist (+1)</span>, and <span className="text-purple-400 font-semibold">Year (+5)</span>.
            </p>
          </div>

          {/* Requirements Card */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-8 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <span className="text-2xl mr-2">📋</span>
              Requirements
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <div className="flex items-center mb-2">
                  <span className="text-xl mr-2">👑</span>
                  <strong className="text-green-400">Host</strong>
                </div>
                <p className="text-slate-300 text-sm">Needs Spotify Premium (to play full tracks)</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <div className="flex items-center mb-2">
                  <span className="text-xl mr-2">🎮</span>
                  <strong className="text-blue-400">Players</strong>
                </div>
                <p className="text-slate-300 text-sm">Any Spotify account (Free or Premium)</p>
              </div>
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            {/* Create Game Card */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl hover:border-green-500/50 transition-all duration-300 group">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-green-500/30 transition-colors">
                  <span className="text-3xl">🎵</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Create New Game</h3>
                <p className="text-slate-400 text-sm mb-6">Start a new game session as the host</p>
                <button
                  onClick={() => {
                    window.location.href = `/auth/login?state=create&host=true`;
                  }}
                  className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-green-500/25"
                >
                  🚀 Create with Spotify
                </button>
              </div>
            </div>

            {/* Join Game Card */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl hover:border-blue-500/50 transition-all duration-300 group">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-500/30 transition-colors">
                  <span className="text-3xl">🎯</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Join Existing Game</h3>
                <p className="text-slate-400 text-sm mb-6">Enter a game code to join as a player</p>
                <div className="space-y-3">
                  <input
                    placeholder="Enter 12-character game code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={12}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  />
                  <button
                    onClick={() => {
                      if (!joinCode.trim()) {
                        alert('Please enter a group code first.');
                        return;
                      }
                      if (isValidGroupName(joinCode)) {
                        window.location.href = `/auth/login?state=join:${encodeURIComponent(joinCode)}`;
                      } else {
                        alert('Group names must be 12 alphanumeric characters.');
                      }
                    }}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-blue-500/25"
                  >
                    🎮 Join with Spotify
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center">
            <p className="text-slate-400 text-sm flex items-center justify-center">
              <span className="text-lg mr-2">🎧</span>
              Connect with Spotify to create or join games
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}