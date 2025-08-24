import React from 'react';

interface SongCardProps {
  track: {
    id: string;
    album?: {
      images?: Array<{ url: string }>;
      name?: string;
    };
    duration_ms?: number;
  };
  answer: {
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
  };
  className?: string;
}

function formatDuration(ms?: number) {
  if (!ms && ms !== 0) return '—';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SongCard({ track, answer, className = '' }: SongCardProps) {
  return (
    <div className={`flex items-center gap-4 p-4 border border-slate-600 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-xl ${className}`}>
      <img
        src={track.album?.images?.[0]?.url || track.album?.images?.[1]?.url}
        alt={answer.title}
        className="w-24 h-24 object-cover rounded"
      />
      <div className="flex flex-col">
        <div className="font-bold text-base">{answer.title}</div>
        <div className="opacity-85 mt-0.5">{answer.artist}</div>
        <div className="opacity-70 mt-0.5">Album: {track.album?.name || '—'}</div>
        <div className="opacity-70 mt-0.5">
          Year: {answer.year} · Duration: {formatDuration(track.duration_ms)}
        </div>

        {answer.attribution && (
          <div className="mt-2 p-2 bg-white/10 rounded">
            <div className="text-xs font-semibold mb-1 text-green-500">Song Sources:</div>
            {answer.attribution.sources.map((source, idx) => (
              <div key={idx} className="text-xs opacity-90 mb-0.5">
                <strong>{source.userName}</strong> - {
                  source.sourceType === 'liked' ? 'Liked Songs' :
                  source.sourceType === 'recent' ? 'Recently Played' :
                  source.sourceType === 'playlist' ? (source.sourceDetail || 'Playlist') :
                  'Top Tracks'
                }
              </div>
            ))}
          </div>
        )}

        {track.id && (
          <a
            href={`https://open.spotify.com/track/${track.id}`}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 text-green-500 no-underline font-semibold"
          >
            Open in Spotify
          </a>
        )}
      </div>
    </div>
  );
}