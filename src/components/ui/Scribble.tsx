/** A hand-drawn strike through ticked-off text. Its parent must be `relative`. */
export function Scribble() {
  return (
    <svg
      viewBox="0 0 100 12"
      preserveAspectRatio="none"
      aria-hidden
      className="hg-scribble pointer-events-none absolute -inset-x-0.5 top-1/2 h-3 -translate-y-1/2 overflow-visible fill-none stroke-accent"
    >
      <path
        pathLength={1}
        d="M1 7 C 15 2, 25 10, 40 6 S 65 3, 80 7 S 95 5, 99 6"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </svg>
  );
}
