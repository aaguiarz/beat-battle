import { useState, useEffect } from 'react';

interface GameMember {
  id: string;
  role: 'host' | 'player';
  name: string;
  avatar?: string;
}

interface GameState {
  track?: {
    id: string;
    album?: {
      images?: Array<{ url: string }>;
      name?: string;
    };
    duration_ms?: number;
  };
  index?: number;
  total?: number;
  contrib?: Record<string, number>;
}

interface Answer {
  title: string;
  artist: string;
  year: number;
  attribution?: {
    sources: Array<{
      userId: string;
      userName: string;
      sourceType: 'liked' | 'recent' | 'playlist' | 'top_tracks';
      sourceDetail?: string;
    }>;
  };
}

export function useGameState(group: string) {
  const [members, setMembers] = useState<GameMember[] | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);

  // Fetch members
  const fetchMembers = async () => {
    if (!group) return;
    try {
      const response = await fetch(`/api/lobby/${encodeURIComponent(group)}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || null);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  };

  // Fetch game state
  const fetchState = async () => {
    if (!group) return;
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(group)}/state`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setState((prev) => ({ ...prev, ...data }));
        if (data?.answer) {
          setAnswer(data.answer);
        } else {
          setAnswer(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch game state:', error);
    }
  };

  // Game actions
  const startGame = async (seed?: number) => {
    const actualSeed = seed || Date.now();
    const response = await fetch(`/api/game/${encodeURIComponent(group)}/start?seed=${actualSeed}`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(await response.text());
    }
    
    const data = await response.json();
    setState(data);
    return data;
  };

  const nextTrack = async () => {
    const response = await fetch(`/api/game/${encodeURIComponent(group)}/next`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(await response.text());
    }
    
    const data = await response.json();
    setState(data);
    return data;
  };

  const prevTrack = async () => {
    const response = await fetch(`/api/game/${encodeURIComponent(group)}/prev`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(await response.text());
    }
    
    const data = await response.json();
    setState(data);
    return data;
  };

  const revealAnswer = async () => {
    const response = await fetch(`/api/game/${encodeURIComponent(group)}/reveal`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(await response.text());
    }
    
    const data = await response.json();
    if (data?.answer) {
      setAnswer(data.answer);
    }
    return data;
  };

  // Polling effects
  useEffect(() => {
    if (!group) return;
    
    fetchMembers();
    const membersInterval = setInterval(fetchMembers, 5000);
    
    return () => clearInterval(membersInterval);
  }, [group]);

  useEffect(() => {
    if (!group) return;
    
    fetchState();
    const stateInterval = setInterval(fetchState, 5000);
    
    return () => clearInterval(stateInterval);
  }, [group]);

  return {
    members,
    state,
    answer,
    setAnswer,
    setMembers,
    startGame,
    nextTrack,
    prevTrack,
    revealAnswer,
    refreshMembers: fetchMembers,
    refreshState: fetchState
  };
}