import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function randomGroup() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function isValidGroupName(s: string) {
  return /^[A-Za-z0-9]{12}$/.test(s);
}

export function Landing() {
  const [joinCode, setJoinCode] = useState('');
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 720 }}>
      <h1>Musica Maestro</h1>
      <p>
        A party game powered by Spotify: create a shared playlist from everyone’s tastes,
        play songs, and score points by identifying the Title (+1), Artist (+1), and Year (+5).
        The host needs Spotify Premium to play full tracks in the browser; other players do not.
      </p>

      <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
        <button onClick={() => {
          const code = randomGroup();
          navigate(`/game?group=${encodeURIComponent(code)}&connect=1`);
        }}>Create New Game</button>
        <div>
          <input
            placeholder="Enter 12-char group code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={12}
            style={{ marginRight: 8 }}
          />
          <button onClick={() => {
            if (isValidGroupName(joinCode)) {
              navigate(`/game?group=${encodeURIComponent(joinCode)}&connect=1`);
            } else {
              alert('Group names must be 12 alphanumeric characters.');
            }
          }}>Join Existing Game</button>
        </div>
      </div>

      <div style={{ marginTop: 16, color: '#555', fontSize: 14 }}>
        Tip: Share the 12-character group code with friends so they can join.
      </div>
    </div>
  );
}

