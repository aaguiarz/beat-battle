import { useState, useCallback } from 'react';

export function useToast() {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string, duration: number = 2000) => {
    setToast(message);
    setTimeout(() => setToast(null), duration);
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  return {
    toast,
    showToast,
    hideToast
  };
}