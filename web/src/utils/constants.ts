export const GAME_SCORING = {
  TITLE_POINTS: 1,
  ARTIST_POINTS: 1,
  YEAR_POINTS: 5
} as const;


export const ACTION_CARDS = {
  CREATE: {
    icon: '🎵',
    title: 'Create New Game',
    description: 'Start a new game session as the host (requires Spotify Premium)',
    buttonText: 'Create with Spotify',
    buttonIcon: '🚀',
    color: 'green' as const,
    action: 'create'
  },
  JOIN: {
    icon: '🎯',
    title: 'Join Existing Game',
    description: 'Enter a game code to join as a player',
    buttonText: 'Join with Spotify',
    buttonIcon: '🎮',
    color: 'blue' as const,
    action: 'join'
  }
} as const;