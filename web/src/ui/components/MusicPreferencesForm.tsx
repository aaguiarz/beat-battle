import React from 'react';
import { Card } from './Card';
import { GradientButton } from './GradientButton';

interface SongPreference {
  includeLiked: boolean;
  includeRecent: boolean;
  includePlaylist: boolean;
  playlistId?: string;
}

interface Playlist {
  id: string;
  name: string;
  tracks: { total: number };
}

interface MusicPreferencesFormProps {
  preference: SongPreference;
  onPreferenceChange: (preference: SongPreference) => void;
  playlists: Playlist[] | null;
  onJoin: () => void;
  isLoading?: boolean;
}

export function MusicPreferencesForm({
  preference,
  onPreferenceChange,
  playlists,
  onJoin,
  isLoading = false
}: MusicPreferencesFormProps) {
  const isDisabled = (
    (!preference.includeLiked && !preference.includeRecent && !preference.includePlaylist) ||
    (preference.includePlaylist && !preference.playlistId)
  );

  return (
    <Card title="Choose Your Music Sources" icon="🎵">
      <p className="text-slate-300 text-sm mb-6">
        Select your music sources for the game. Your songs will be combined with other players' choices.
      </p>

      <div className="space-y-4">
        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-600 hover:border-green-500/50 cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={preference.includeLiked}
            onChange={(e) => onPreferenceChange({ ...preference, includeLiked: e.target.checked })}
            className="w-4 h-4 text-green-500 bg-slate-700 border-slate-500 rounded focus:ring-green-500 focus:ring-2"
          />
          <span className="text-white flex items-center gap-2">
            <span className="text-lg">❤️</span>
            My liked songs
          </span>
        </label>

        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-600 hover:border-blue-500/50 cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={preference.includeRecent}
            onChange={(e) => onPreferenceChange({ ...preference, includeRecent: e.target.checked })}
            className="w-4 h-4 text-blue-500 bg-slate-700 border-slate-500 rounded focus:ring-blue-500 focus:ring-2"
          />
          <span className="text-white flex items-center gap-2">
            <span className="text-lg">🕒</span>
            My recently played tracks
          </span>
        </label>

        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-600 hover:border-purple-500/50 cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={preference.includePlaylist}
            onChange={(e) => onPreferenceChange({
              ...preference,
              includePlaylist: e.target.checked,
              playlistId: e.target.checked ? (playlists?.[0]?.id || preference.playlistId) : undefined
            })}
            className="w-4 h-4 text-purple-500 bg-slate-700 border-slate-500 rounded focus:ring-purple-500 focus:ring-2"
          />
          <span className="text-white flex items-center gap-2">
            <span className="text-lg">📝</span>
            A specific playlist
          </span>
        </label>

        {preference.includePlaylist && playlists && (
          <div className="ml-8 mt-2">
            <select
              value={preference.playlistId || ''}
              onChange={(e) => onPreferenceChange({ ...preference, playlistId: e.target.value })}
              className="w-full bg-slate-900/70 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
            >
              {playlists.map(playlist => (
                <option key={playlist.id} value={playlist.id} className="bg-slate-800">
                  {playlist.name} ({playlist.tracks.total} tracks)
                </option>
              ))}
            </select>
          </div>
        )}

        {!playlists && preference.includePlaylist && (
          <div className="ml-8 mt-2 text-slate-400 text-sm flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
            Loading playlists...
          </div>
        )}
      </div>

      <div className="mt-6 text-center">
        <GradientButton
          icon="🎮"
          disabled={isDisabled || isLoading}
          onClick={onJoin}
        >
          {isLoading ? 'Joining...' : 'Join Game'}
        </GradientButton>
      </div>
    </Card>
  );
}