import { useCallback } from 'react';

export function useGameJoin() {
  const createGame = useCallback(() => {
    window.location.href = `/auth/login?state=create&host=true`;
  }, []);

  const joinGame = useCallback((gameCode: string) => {
    window.location.href = `/auth/login?state=join:${encodeURIComponent(gameCode)}`;
  }, []);

  const showError = useCallback((error: string) => {
    // For now using alert, but this could be enhanced with a toast system
    alert(error);
  }, []);

  return {
    createGame,
    joinGame,
    showError
  };
}