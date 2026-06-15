const UNIT_SECONDS: Record<string, number> = {
  second: 1,
  seconds: 1,
  sec: 1,
  secs: 1,
  minute: 60,
  minutes: 60,
  min: 60,
  mins: 60,
  hour: 3600,
  hours: 3600,
  hr: 3600,
  hrs: 3600,
};

const DURATION_REGEX =
  /(\d+)\s*(?:(?:-|–|to)\s*(\d+)\s*)?(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i;

/**
 * Finds the first time duration mentioned in a recipe step (e.g.
 * "cook for 10 minutes" or "rest for 20-30 seconds") and returns it
 * in seconds. For ranges, the upper bound is used. Returns null if
 * no duration is found.
 */
export function extractDurationSeconds(text: string): number | null {
  const match = text.match(DURATION_REGEX);
  if (!match) return null;

  const lower = Number(match[1]);
  const upper = match[2] ? Number(match[2]) : undefined;
  const unit = match[3].toLowerCase();
  const multiplier = UNIT_SECONDS[unit] ?? 60;

  const value = upper ?? lower;
  return value * multiplier;
}

export function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
