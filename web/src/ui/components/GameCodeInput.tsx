import React, { useState } from 'react';
import { validateJoinCode } from '../../utils/validation';
import { GradientButton } from './GradientButton';

interface GameCodeInputProps {
  onJoin: (code: string) => void;
  onError: (error: string) => void;
  buttonText?: string;
  buttonIcon?: string;
}

export function GameCodeInput({ 
  onJoin, 
  onError, 
  buttonText = 'Join with Spotify',
  buttonIcon = '🎮'
}: GameCodeInputProps) {
  const [joinCode, setJoinCode] = useState('');

  const handleJoin = () => {
    const validation = validateJoinCode(joinCode);
    
    if (!validation.isValid) {
      onError(validation.error!);
      return;
    }
    
    onJoin(joinCode.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJoin();
    }
  };

  return (
    <div className="space-y-3">
      <input
        placeholder="Enter 12-character game code"
        value={joinCode}
        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
        onKeyPress={handleKeyPress}
        maxLength={12}
        className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
      />
      <GradientButton
        variant="blue"
        icon={buttonIcon}
        onClick={handleJoin}
        className="w-full"
      >
        {buttonText}
      </GradientButton>
    </div>
  );
}