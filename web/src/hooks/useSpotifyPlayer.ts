import { useState, useEffect } from 'react';
import { 
  subscribeToPlayerState, 
  getThisDevice, 
  getVolume, 
  setVolume as setPlayerVolume,
  togglePlay,
  activatePlayer
} from '../spotify/player';

interface DeviceInfo {
  name: string;
  is_active: boolean;
}

export function useSpotifyPlayer() {
  const [sdkState, setSdkState] = useState<any>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [volume, setVolume] = useState<number>(80);

  const updateVolume = async (level: number) => {
    const clampedLevel = Math.max(0, Math.min(100, level));
    setVolume(clampedLevel);
    try {
      await setPlayerVolume(clampedLevel / 100);
    } catch (error) {
      console.error('Failed to set volume:', error);
    }
  };

  const activate = async () => {
    try {
      await activatePlayer();
    } catch (error) {
      console.warn('Failed to activate player:', error);
    }
  };

  const togglePlayback = async () => {
    try {
      await activate();
      await togglePlay();
    } catch (error) {
      console.error('Failed to toggle playback:', error);
    }
  };

  useEffect(() => {
    // Subscribe to player state changes
    const unsubscribe = subscribeToPlayerState((state) => {
      setSdkState(state);
    });

    // Poll device info
    const pollDeviceInfo = async () => {
      try {
        const info = await getThisDevice();
        if (info) {
          setDeviceInfo({ name: info.name, is_active: info.is_active });
        }
      } catch (error) {
        console.warn('Failed to get device info:', error);
      }
    };

    // Initialize volume
    const initializeVolume = async () => {
      try {
        const currentVolume = await getVolume();
        setVolume(Math.round(currentVolume * 100));
      } catch (error) {
        console.warn('Failed to get initial volume:', error);
      }
    };

    pollDeviceInfo();
    initializeVolume();
    
    const devicePollingInterval = setInterval(pollDeviceInfo, 5000);

    return () => {
      unsubscribe();
      clearInterval(devicePollingInterval);
    };
  }, []);

  return {
    sdkState,
    deviceInfo,
    volume,
    updateVolume,
    togglePlayback,
    activate
  };
}