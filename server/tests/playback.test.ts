import { describe, it, expect, beforeAll } from 'vitest';

// Start the server by importing the entrypoint once
let serverStarted = false;
beforeAll(async () => {
  if (serverStarted) return;
  // Ensure PORT is set to a stable value for tests
  process.env.PORT = process.env.PORT || '4010';
  process.env.BASE_URL = `http://127.0.0.1:${process.env.PORT}`;
  await import('../src/index.js');
  // Small delay to allow the server to bind
  await new Promise((r) => setTimeout(r, 200));
  serverStarted = true;
});

const base = () => `http://127.0.0.1:${process.env.PORT || '4010'}`;

describe('Host playback routes - auth guards', () => {
  it('GET /api/playback/devices requires auth', async () => {
    const r = await fetch(`${base()}/api/playback/devices`);
    expect(r.status).toBe(401);
  });

  it('PUT /api/playback/transfer requires auth', async () => {
    const r = await fetch(`${base()}/api/playback/transfer`, { method: 'PUT' });
    expect(r.status).toBe(401);
  });

  it('PUT /api/playback/play requires auth', async () => {
    const r = await fetch(`${base()}/api/playback/play`, { method: 'PUT' });
    expect(r.status).toBe(401);
  });

  it('PUT /api/playback/pause requires auth', async () => {
    const r = await fetch(`${base()}/api/playback/pause`, { method: 'PUT' });
    expect(r.status).toBe(401);
  });

  it('PUT /api/playback/seek requires auth', async () => {
    const r = await fetch(`${base()}/api/playback/seek`, { method: 'PUT' });
    expect(r.status).toBe(401);
  });

  it('POST /api/playback/queue requires auth', async () => {
    const r = await fetch(`${base()}/api/playback/queue`, { method: 'POST' });
    expect(r.status).toBe(401);
  });

  it('POST /api/playback/next requires auth', async () => {
    const r = await fetch(`${base()}/api/playback/next`, { method: 'POST' });
    expect(r.status).toBe(401);
  });

  it('GET /api/playback/current requires auth', async () => {
    const r = await fetch(`${base()}/api/playback/current`);
    expect(r.status).toBe(401);
  });
});

