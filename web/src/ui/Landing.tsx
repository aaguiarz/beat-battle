import React, { useState } from 'react';

function isValidGroupName(s: string) {
  return /^[A-Za-z0-9]{12}$/.test(s);
}

export function Landing() {
  const [joinCode, setJoinCode] = useState('');

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 720 }}>
      <h1>Musica Maestro</h1>
      <p>
        A party game powered by Spotify: create a shared playlist from everyone's tastes,
        play songs, and score points by identifying the Title (+1), Artist (+1), and Year (+5).
      </p>
      <div style={{ padding: 12, background: '#f0f8ff', border: '1px solid #cce7ff', borderRadius: 6, marginTop: 12 }}>
        <strong>Requirements:</strong>
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li><strong>Host:</strong> Needs Spotify Premium (to play full tracks)</li>
          <li><strong>Players:</strong> Any Spotify account (Free or Premium)</li>
        </ul>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
        <button onClick={() => {
          // Redirect to Spotify login for host permissions with create intent
          window.location.href = `/auth/login?state=create&host=true`;
        }}>Login with Spotify to Create a New Game</button>
        <div>
          <input
            placeholder="Enter 12-char group code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={12}
            style={{ marginRight: 8 }}
          />
          <button onClick={() => {
            if (!joinCode.trim()) {
              alert('Please enter a group code first.');
              return;
            }
            if (isValidGroupName(joinCode)) {
              // Redirect to Spotify login for player permissions with join intent
              window.location.href = `/auth/login?state=join:${encodeURIComponent(joinCode)}`;
            } else {
              alert('Group names must be 12 alphanumeric characters.');
            }
          }}>Login with Spotify to Join an Existing Game</button>
        </div>
      </div>
      <div style={{ marginTop: 16, color: '#555', fontSize: 14 }}>
        Connect with Spotify to create or join games.
      </div>
    </div>
  );
}