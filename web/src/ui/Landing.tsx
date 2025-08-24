import React from 'react';
import { HeroSection } from './components/HeroSection';
import { RequirementsCard } from './components/RequirementsCard';
import { ActionCard } from './components/ActionCard';
import { GameCodeInput } from './components/GameCodeInput';
import { useGameJoin } from '../hooks/useGameJoin';
import { ACTION_CARDS } from '../utils/constants';

export function Landing() {
  const { createGame, joinGame, showError } = useGameJoin();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <HeroSection />
          <RequirementsCard />

          {/* Action Cards */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <ActionCard
              icon={ACTION_CARDS.CREATE.icon}
              title={ACTION_CARDS.CREATE.title}
              description={ACTION_CARDS.CREATE.description}
              color={ACTION_CARDS.CREATE.color}
              buttonText={ACTION_CARDS.CREATE.buttonText}
              buttonIcon={ACTION_CARDS.CREATE.buttonIcon}
              onClick={createGame}
            />

            <ActionCard
              icon={ACTION_CARDS.JOIN.icon}
              title={ACTION_CARDS.JOIN.title}
              description={ACTION_CARDS.JOIN.description}
              color={ACTION_CARDS.JOIN.color}
              buttonText={ACTION_CARDS.JOIN.buttonText}
              buttonIcon={ACTION_CARDS.JOIN.buttonIcon}
              hideButton={true}
            >
              <GameCodeInput onJoin={joinGame} onError={showError} />
            </ActionCard>
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