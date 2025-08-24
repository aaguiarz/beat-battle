# Host Playback (Spotify Connect)

This mode lets the host control music playback on a real Spotify device (phone/desktop/speaker) using Spotify Connect via the Web API. It avoids mobile browser audio limitations and is the recommended default.

## Requirements

- Spotify Premium for the host
- Scopes requested when host logs in: `user-modify-playback-state`, `user-read-playback-state`, `user-read-currently-playing` (plus existing base scopes). The flow already sets these when `?host=true` is used.

## Server Endpoints

- `GET /api/playback/devices` — List Connect devices
- `PUT /api/playback/transfer` — Body: `{ deviceId, play?: boolean }`
- `PUT /api/playback/play` — Body: `{ deviceId?, trackId?, uri?, uris?, positionMs? }`
- `PUT /api/playback/pause` — Body: `{ deviceId? }`
- `PUT /api/playback/seek` — Body: `{ deviceId, positionMs }`
- `POST /api/playback/queue` — Body: `{ deviceId?, uri? | trackId? }`
- `POST /api/playback/next` — Body: `{ deviceId? }`
- `GET /api/playback/current` — Currently playing info

All endpoints use the host session’s access token (stored in the cookie session). They return `401` if the user is not authenticated.

## Web UI

- Component: `web/src/ui/components/HostPlaybackControls.tsx`
  - Device selector (automatically pre-selects active device, no persistence)
  - Buttons: Refresh, Transfer & Play, Play Current, Pause, Next, Seek 0:00
- Integration: `web/src/ui/App.tsx`
  - When a device is selected, new round tracks autostart on that device via the server. Falls back to the Web Playback SDK if Connect control fails or no device is selected.

## Usage Flow

1. Host signs in (use the “Create Game” flow). The server requests host scopes automatically.
2. Open the Spotify app on the host device and press play/pause once to ensure the device is active.
3. In the Game page, open “Host Playback (Spotify Connect)”, click Refresh, select the device, then “Transfer & Play”.
4. Start the game; rounds will play on the selected device. Use Pause/Next/Seek for control.

## Troubleshooting

- Transfer fails: Open the Spotify app on the device, press play/pause once, then retry Transfer.
- Nothing plays: Ensure the host has Premium and that the selected device is not “restricted”. Try a different device.
- Regional availability: Some tracks are not playable in certain markets; the server/game logic should skip unplayable tracks when possible.

## Configuration

- `HOST_PLAYBACK_MODE` in `.env` controls the default host playback method:
  - `connect` (default): Use Spotify Connect via Web API (server routes).
  - `websdk`: Use the in-browser Web Playback SDK.
- `CLIP_STOP_AFTER_MS` in `.env` optionally stops playback after X ms (e.g., `30000`).
- The front-end reads `/api/config` and adapts the UI:
  - `connect`: Shows the device picker/controls and auto-plays on the chosen device.
  - `websdk`: Shows the Web SDK mini player and status panel.
