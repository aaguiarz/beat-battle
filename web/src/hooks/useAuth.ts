import { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  role?: 'host' | 'player';
  group?: string;
  memberId?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/me', { credentials: 'include' });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
    }
  };

  const refreshUser = () => {
    setIsLoading(true);
    checkAuth();
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return {
    user,
    isLoading,
    logout,
    refreshUser,
    isAuthenticated: !!user
  };
}