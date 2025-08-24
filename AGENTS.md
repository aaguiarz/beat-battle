# Repository Guidelines

## Project Structure & Module Organization
- `server/`: Spotify OAuth, playlist aggregation, game API (Node/Express or Fastify).
- `web/`: Client app (Next.js/React) for lobby, groups, gameplay, and scoreboard.
- `tests/`: Unit/integration tests for server and web.
- `scripts/`: One‑offs (e.g., seed demo tracks, data export).
- `assets/`: Static logos/images; do not store audio.
- `docs/` and `.env.example`: Design notes and required env vars.

## Build, Test, and Development Commands
- `npm install`: Install dependencies.
- `npm run dev`: Start web and API locally (concurrently) with hot reload.
- `npm run build`: Production build for both web and server.
- `npm start`: Run the built server.
- `npm test` / `npm run test:watch`: Run tests once / in watch mode.
- `npm run lint` / `npm run format`: Lint and format with ESLint/Prettier.

## Coding Style & Naming Conventions
- TypeScript, 2‑space indentation, semicolons on, single quotes.
- File names: `kebab-case.ts`; React components: `PascalCase.tsx`.
- Variables/functions: `camelCase`; constants: `UPPER_SNAKE_CASE`.
- Enforce via ESLint + Prettier; fix before committing: `npm run lint && npm run format`.

## Testing Guidelines
- Framework: Vitest (or Jest if specified in package.json).
- Test files: `tests/**/*.test.ts` and `web/**/*.test.tsx`.
- Coverage target ≥ 80% lines/branches for core game and auth.
- Include tests for scoring (name+artist = 1 point; year = 5 points), playlist merging, and auth guards.

## Commit & Pull Request Guidelines
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Small, focused PRs with description, linked issue, screenshots for UI, and test notes.
- CI must pass (build, lint, test) before review.

## Security & Configuration Tips
- Required env vars: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `SESSION_SECRET`, `BASE_URL`.
- Spotify scopes: `user-top-read`, `user-read-recently-played`, `user-library-read`, `playlist-modify-private`, `playlist-modify-public`.
- Never commit `.env`; use `.env.example`. Rotate secrets when contributors change.

## Architecture Overview
1. Users authenticate via Spotify OAuth.
2. Server fetches top tracks/artists and recent plays per user.
3. Merge preferences to build a shared playlist (weighted by recency/top ranks).
4. Game engine selects tracks, plays preview/track (per license), collects guesses.
5. Scoring: +1 for correct name+artist, +5 for exact year; leaderboard updates live.
