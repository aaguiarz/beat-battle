import { describe, it, expect } from 'vitest';
import { scoreGuess } from '../src/modules/scoring.js';

describe('scoreGuess', () => {
  const actual = { title: 'Blinding Lights', artist: 'The Weeknd', year: 2019 };

  it('awards 1 point for exact name+artist', () => {
    const points = scoreGuess({ title: 'Blinding Lights', artist: 'The Weeknd' }, actual);
    expect(points).toBe(1);
  });

  it('awards 5 points for exact year', () => {
    const points = scoreGuess({ year: 2019 }, actual);
    expect(points).toBe(5);
  });

  it('awards 6 points for name+artist+year', () => {
    const points = scoreGuess({ title: 'Blinding Lights', artist: 'The Weeknd', year: 2019 }, actual);
    expect(points).toBe(6);
  });

  it('awards 0 for partial name or artist only', () => {
    expect(scoreGuess({ title: 'Blinding Lights' }, actual)).toBe(0);
    expect(scoreGuess({ artist: 'The Weeknd' }, actual)).toBe(0);
  });
});

