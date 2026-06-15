// Decimal -> nicely formatted fraction, for scaled ingredient amounts.
const NICE_FRACTIONS: [number, string][] = [
  [1 / 8, '1/8'],
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [3 / 8, '3/8'],
  [1 / 2, '1/2'],
  [5 / 8, '5/8'],
  [2 / 3, '2/3'],
  [3 / 4, '3/4'],
  [7 / 8, '7/8'],
];

function formatScaledNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  const whole = Math.floor(rounded);
  const frac = rounded - whole;

  if (frac < 0.02) return String(whole || rounded);

  for (const [dec, label] of NICE_FRACTIONS) {
    if (Math.abs(frac - dec) < 0.02) {
      return whole > 0 ? `${whole} ${label}` : label;
    }
  }

  // No close fraction match - fall back to a short decimal.
  const decimalValue = Math.round(rounded * 100) / 100;
  return String(decimalValue);
}

/**
 * Scales a recipe amount string by `ratio`, handling whole numbers,
 * decimals, simple fractions ("1/2") and mixed numbers ("1 1/2").
 * Non-numeric amounts (e.g. "a pinch") are returned unchanged.
 */
export function scaleAmount(amount: string, ratio: number): string {
  const trimmed = amount.trim();
  if (!trimmed || ratio === 1) return amount;

  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const value =
      Number(mixedMatch[1]) + Number(mixedMatch[2]) / Number(mixedMatch[3]);
    return formatScaledNumber(value * ratio);
  }

  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const value = Number(fractionMatch[1]) / Number(fractionMatch[2]);
    return formatScaledNumber(value * ratio);
  }

  const numberMatch = trimmed.match(/^(\d*\.?\d+)$/);
  if (numberMatch) {
    const value = Number(numberMatch[1]);
    return formatScaledNumber(value * ratio);
  }

  return amount;
}
