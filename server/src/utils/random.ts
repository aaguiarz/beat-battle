// Seeded PRNG (Mulberry32)
export function createPRNG(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Weighted random sampling without replacement
export function weightedSample(weights: Map<string, number>, k: number, seed: number): string[] {
  const prng = createPRNG(seed);
  // Clone weights into an array
  const pool = Array.from(weights.entries()).filter(([, w]) => w > 0);
  const chosen: string[] = [];
  for (let i = 0; i < k && pool.length > 0; i++) {
    const total = pool.reduce((sum, [, w]) => sum + w, 0);
    let pick = prng() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      pick -= pool[idx][1];
      if (pick <= 0) break;
    }
    const [id] = pool.splice(Math.min(idx, pool.length - 1), 1)[0];
    chosen.push(id);
  }
  return chosen;
}

