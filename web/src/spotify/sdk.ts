declare global {
  interface Window { onSpotifyWebPlaybackSDKReady?: () => void; Spotify?: any }
}

export function loadSpotifySDK(): Promise<any> {
  if ((window as any).Spotify) return Promise.resolve((window as any).Spotify);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load Spotify SDK'));
    window.onSpotifyWebPlaybackSDKReady = () => resolve((window as any).Spotify);
    document.body.appendChild(script);
  });
}

