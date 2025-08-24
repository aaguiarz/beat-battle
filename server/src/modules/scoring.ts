export type TrackInfo = {
  title: string;
  artist: string;
  year: number; // full year, e.g., 2016
};

export type Guess = {
  title?: string;
  artist?: string;
  year?: number;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(feat\..*?\)/g, '')
    .replace(/feat\..*$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function scoreGuess(guess: Guess, actual: TrackInfo): number {
  if (!actual) throw new Error('Missing actual track');
  let points = 0;
  const gTitle = guess?.title?.trim();
  const gArtist = guess?.artist?.trim();

  if (gTitle && gArtist) {
    const matchTitle = normalize(gTitle) === normalize(actual.title);
    const matchArtist = normalize(gArtist) === normalize(actual.artist);
    if (matchTitle && matchArtist) points += 1; // name + artist correct
  }

  if (typeof guess?.year === 'number' && guess.year === actual.year) {
    points += 5; // exact year
  }
  return points;
}

