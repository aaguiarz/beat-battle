import { lobby } from './lobby.js';
import { store } from './store.js';
import { getTopTracks, getRecentlyPlayed, getSavedTracks, getPlaylistTracks, getPlaylist, type SimpleTrack } from './spotify.js';
import { weightedSample } from './utils/random.js';

export type TrackAttribution = {
  trackId: string;
  sources: Array<{
    userId: string;
    userName: string;
    sourceType: 'liked' | 'recent' | 'playlist' | 'top_tracks';
    sourceDetail?: string; // playlist name for playlists
  }>;
};

export type Aggregated = { 
  tracks: SimpleTrack[]; 
  byUser: Record<string, string[]>;
  attributions: Record<string, TrackAttribution>;
};

export async function aggregateGroup(group: string, targetCount = 100, seed?: number): Promise<Aggregated> {
  const members = lobby.members(group);
  const byUser: Record<string, string[]> = {};
  const attributions: Record<string, TrackAttribution> = {};
  const userTrackCollections: Array<{ userId: string; userName: string; tracks: Array<{ track: SimpleTrack; sourceType: string; sourceDetail?: string }> }> = [];
  
  console.log(`[Aggregation Debug] Group: ${group}, Members: ${members.length}`, members);
  console.log(`[Aggregation Debug] Users with stored tokens:`, store.getAllStoredUsers());

  for (const uid of members) {
    const baseUserId = uid.split('#')[0]; // Handle host participants like uid#participant
    const tokens = store.getTokens(baseUserId);
    console.log(`[Aggregation Debug] Processing user: ${uid} (base: ${baseUserId}), has tokens: ${!!tokens}`);
    if (!tokens) {
      console.log(`[Aggregation Debug] SKIPPING user ${baseUserId} - no tokens found`);
      continue;
    }
    const accessToken = tokens.access_token;
    const userName = store.getName(baseUserId) || baseUserId;

    // Get user preference, fallback to default behavior if none set
    const preference = lobby.getUserPreference(group, baseUserId);
    console.log(`[Aggregation Debug] User ${baseUserId} preference:`, preference);
    const userTracksWithSources: Array<{ track: SimpleTrack; sourceType: string; sourceDetail?: string }> = [];
    
    try {
      console.log(`[Aggregation Debug] User ${baseUserId} preference check:`, { preference, hasPreference: !!preference });
      if (preference && (preference.includeLiked || preference.includeRecent || preference.includePlaylist)) {
        console.log(`[Aggregation Debug] User ${baseUserId} using preferences:`, preference);
        
        // Handle liked songs
        if (preference.includeLiked) {
          if (process.env.LOG_SPOTIFY_API_CALLS?.toLowerCase() === 'true') {
            console.log(`[Aggregation] Fetching liked songs for user ${baseUserId}`);
          }
          
          // First, get total count of saved tracks
          const initialFetch = await getSavedTracks({ accessToken, limit: 1, offset: 0 });
          const totalSavedTracks = initialFetch.total;
          
          if (totalSavedTracks > 0) {
            const fetchLimit = 50;
            const maxTracksToFetch = Math.min(200, totalSavedTracks); // Fetch up to 200 tracks
            const numBatches = Math.ceil(maxTracksToFetch / fetchLimit);
            
            // Generate random offsets to get different subsets each time
            const offsets: number[] = [];
            for (let i = 0; i < numBatches; i++) {
              let randomOffset;
              if (totalSavedTracks <= maxTracksToFetch) {
                // If user has fewer tracks than our limit, use sequential offsets
                randomOffset = i * fetchLimit;
              } else {
                // Use random offsets within the available range
                const maxOffset = totalSavedTracks - fetchLimit;
                randomOffset = Math.floor(Math.random() * (maxOffset + 1));
              }
              offsets.push(randomOffset);
            }
            
            // Remove duplicates and sort offsets
            const uniqueOffsets = Array.from(new Set(offsets)).sort((a, b) => a - b);
            
            // Fetch tracks from different random positions
            const allLikedTracks: SimpleTrack[] = [];
            for (const offset of uniqueOffsets) {
              try {
                const savedBatch = await getSavedTracks({ 
                  accessToken, 
                  limit: fetchLimit, 
                  offset: offset 
                });
                const batchTracks = savedBatch.items.map(item => item.track);
                allLikedTracks.push(...batchTracks);
              } catch (error) {
                console.warn(`[Aggregation] Failed to fetch liked songs at offset ${offset}:`, error);
              }
            }
            
            // Remove duplicates (in case random offsets overlapped)
            const uniqueLikedTracks = allLikedTracks.filter((track, index, self) =>
              index === self.findIndex(t => t.id === track.id)
            );
            
            uniqueLikedTracks.forEach((track) => {
              userTracksWithSources.push({ track, sourceType: 'liked' });
            });
            
            console.log(`[Aggregation] User ${baseUserId} contributed ${uniqueLikedTracks.length} liked songs from ${totalSavedTracks} total`);
          }
        }
        
        // Handle recent tracks
        if (preference.includeRecent) {
          if (process.env.LOG_SPOTIFY_API_CALLS?.toLowerCase() === 'true') {
            console.log(`[Aggregation] Fetching recently played tracks for user ${baseUserId}`);
          }
          const recent = await getRecentlyPlayed({ accessToken, limit: 50 });
          const recentTracks = recent.items.map(item => item.track);
          
          recentTracks.forEach((track) => {
            userTracksWithSources.push({ track, sourceType: 'recent' });
          });
        }
        
        // Handle playlist
        if (preference.includePlaylist && preference.playlistId) {
          if (process.env.LOG_SPOTIFY_API_CALLS?.toLowerCase() === 'true') {
            console.log(`[Aggregation] Fetching playlist ${preference.playlistId} for user ${baseUserId}`);
          }
          
          // Fetch playlist info to get the name
          const playlistInfo = await getPlaylist({ accessToken, playlistId: preference.playlistId });
          const playlistName = playlistInfo.name || `Playlist ${preference.playlistId}`;
          
          const playlistTracks1 = await getPlaylistTracks({ accessToken, playlistId: preference.playlistId, limit: 50, offset: 0 });
          const playlistTracks2 = await getPlaylistTracks({ accessToken, playlistId: preference.playlistId, limit: 50, offset: 50 });
          const allPlaylistItems = [...playlistTracks1.items, ...playlistTracks2.items];
          const playlistTracks = allPlaylistItems.filter(item => item.track !== null).map(item => item.track!);
          
          playlistTracks.forEach((track) => {
            userTracksWithSources.push({ track, sourceType: 'playlist', sourceDetail: playlistName });
          });
        }
        
      } else {
        // Fallback: use top tracks if no preference or invalid preference
        console.log(`[Aggregation Debug] User ${baseUserId} using fallback (top tracks)`);
        if (process.env.LOG_SPOTIFY_API_CALLS?.toLowerCase() === 'true') {
          console.log(`[Aggregation] Using top tracks fallback for user ${baseUserId}`);
        }
        const [shortTerm, mediumTerm, longTerm] = await Promise.all([
          getTopTracks({ accessToken, time_range: 'short_term' }),
          getTopTracks({ accessToken, time_range: 'medium_term' }),
          getTopTracks({ accessToken, time_range: 'long_term' })
        ]);
        
        [...shortTerm, ...mediumTerm, ...longTerm].forEach((track) => {
          userTracksWithSources.push({ track, sourceType: 'top_tracks' });
        });
      }
    } catch (error) {
      if (process.env.LOG_SPOTIFY_API_CALLS?.toLowerCase() === 'true') {
        console.log(`[Aggregation] Error fetching tracks for user ${baseUserId}:`, (error as Error).message);
      }
      // Continue with next user if this one fails
      continue;
    }

    // Store user's track collection
    userTrackCollections.push({ userId: baseUserId, userName, tracks: userTracksWithSources });
    
    // Track provenance per user (keep IDs only)
    byUser[uid] = Array.from(new Set(userTracksWithSources.map(t => t.track.id)));
    
    if (process.env.LOG_SPOTIFY_API_CALLS?.toLowerCase() === 'true') {
      console.log(`[Aggregation] User ${baseUserId} contributed ${byUser[uid].length} unique tracks`);
    }
  }

  // Balanced track selection with randomization and attribution tracking
  const selectedTracks: SimpleTrack[] = [];
  const trackToAttributionMap = new Map<string, Array<{ userId: string; userName: string; sourceType: string; sourceDetail?: string }>>();
  
  // Build attribution map
  for (const userCollection of userTrackCollections) {
    for (const { track, sourceType, sourceDetail } of userCollection.tracks) {
      if (!trackToAttributionMap.has(track.id)) {
        trackToAttributionMap.set(track.id, []);
      }
      trackToAttributionMap.get(track.id)!.push({
        userId: userCollection.userId,
        userName: userCollection.userName,
        sourceType,
        sourceDetail
      });
    }
  }
  
  console.log(`[Aggregation Debug] Found ${trackToAttributionMap.size} unique tracks from ${userTrackCollections.length} users`);
  
  if (userTrackCollections.length === 0) {
    console.log(`[Aggregation Debug] No users with tracks found`);
    return { tracks: [], byUser: {}, attributions: {} };
  }
  
  // Create a shuffled list of all unique tracks
  const allUniqueTracksWithAttribution = Array.from(trackToAttributionMap.entries()).map(([trackId, sources]) => {
    // Find any track object from the sources
    const track = userTrackCollections
      .flatMap(uc => uc.tracks)
      .find(t => t.track.id === trackId)?.track;
    return { track: track!, sources };
  });
  
  // Shuffle with seed for deterministic randomization
  if (seed !== undefined) {
    // Simple seeded shuffle using the seed
    let rng = seed;
    for (let i = allUniqueTracksWithAttribution.length - 1; i > 0; i--) {
      rng = (rng * 9301 + 49297) % 233280; // Linear congruential generator
      const j = rng % (i + 1);
      [allUniqueTracksWithAttribution[i], allUniqueTracksWithAttribution[j]] = 
        [allUniqueTracksWithAttribution[j], allUniqueTracksWithAttribution[i]];
    }
  } else {
    // Regular shuffle
    for (let i = allUniqueTracksWithAttribution.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allUniqueTracksWithAttribution[i], allUniqueTracksWithAttribution[j]] = 
        [allUniqueTracksWithAttribution[j], allUniqueTracksWithAttribution[i]];
    }
  }
  
  // Balance selection: try to get roughly equal contribution from each user
  const targetPerUser = Math.ceil(targetCount / userTrackCollections.length);
  const userContributions = new Map<string, number>();
  
  // Initialize counters
  for (const userCollection of userTrackCollections) {
    userContributions.set(userCollection.userId, 0);
  }
  
  // First pass: select tracks trying to balance between users
  for (const { track, sources } of allUniqueTracksWithAttribution) {
    if (selectedTracks.length >= targetCount) break;
    
    // Check if any user contributing this track is under their target
    const canContribute = sources.some(source => 
      (userContributions.get(source.userId) || 0) < targetPerUser
    );
    
    if (canContribute) {
      selectedTracks.push(track);
      
      // Build attribution for this track
      attributions[track.id] = {
        trackId: track.id,
        sources: sources.map(s => ({
          userId: s.userId,
          userName: s.userName,
          sourceType: s.sourceType as any,
          sourceDetail: s.sourceDetail
        }))
      };
      
      // Increment counters for contributing users
      for (const source of sources) {
        userContributions.set(source.userId, (userContributions.get(source.userId) || 0) + 1);
      }
    }
  }
  
  // Second pass: fill remaining slots if needed
  if (selectedTracks.length < targetCount) {
    for (const { track, sources } of allUniqueTracksWithAttribution) {
      if (selectedTracks.length >= targetCount) break;
      if (selectedTracks.some(t => t.id === track.id)) continue; // Skip already selected
      
      selectedTracks.push(track);
      attributions[track.id] = {
        trackId: track.id,
        sources: sources.map(s => ({
          userId: s.userId,
          userName: s.userName,
          sourceType: s.sourceType as any,
          sourceDetail: s.sourceDetail
        }))
      };
    }
  }
  
  console.log(`[Aggregation Debug] Final aggregated playlist has ${selectedTracks.length} tracks from ${userTrackCollections.length} users`);
  console.log(`[Aggregation Debug] User contributions:`, Array.from(userContributions.entries()).map(([userId, count]) => `${userId}: ${count}`));
  
  if (process.env.LOG_SPOTIFY_API_CALLS?.toLowerCase() === 'true') {
    console.log(`[Aggregation] Final aggregated playlist has ${selectedTracks.length} tracks from ${userTrackCollections.length} users`);
  }
  
  return { tracks: selectedTracks, byUser, attributions };
}
