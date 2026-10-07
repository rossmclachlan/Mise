// Mise shows a food emoji in its header; Tandem shows a pair of animals,
// a different pair each day.
const PAIRS = [
  '🐧🐧', '🦦🦦', '🦢🦢', '🦩🦩', '🐢🐇', '🦊🐻', '🐝🐞', '🐑🐐',
  '🦉🦇', '🐳🐬', '🐸🦎', '🐨🐼', '🐈🐕', '🐌🐛', '🦆🦆', '🐿️🦔',
  '🐴🐴', '🐘🐘', '🦒🦓', '🐓🐣', '🐙🦀', '🦜🦜', '🐄🐖', '🦭🐻‍❄️',
];

export function emojiPairFor(date: Date = new Date()): string {
  const day = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
  return PAIRS[day % PAIRS.length];
}
