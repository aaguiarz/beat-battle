import React from 'react';
import { GAME_SCORING } from '../../utils/constants';

export function HeroSection() {
  return (
    <div className="text-center mb-12">
      <h1 className="text-6xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent mb-6">
        🎵 Beat Battle
      </h1>
      <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto">
        A party game powered by Spotify: create a shared playlist from everyone's tastes,
        play songs, and score points by identifying the song details!
      </p>
    </div>
  );
}