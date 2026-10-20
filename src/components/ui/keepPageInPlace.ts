// iPhone Safari scrolls the whole page up to make room for the keyboard. Both
// apps are a fixed full-screen layout that never scrolls the page itself, and
// when the keyboard closes Safari can leave the page scrolled: everything is
// drawn in place but taps land where things would be, one row lower. Putting
// the page back once nothing is being typed into keeps taps on target.

function isTyping(): boolean {
  const el = document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable);
}

function restore() {
  if (isTyping()) return;
  if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
}

/** Call once at startup, in both apps. */
export function keepPageInPlace() {
  // After blur, focus may move to another field; wait a moment before checking.
  document.addEventListener('focusout', () => setTimeout(restore, 100));
  // The keyboard's closing animation resizes the visual viewport.
  window.visualViewport?.addEventListener('resize', restore);
  window.addEventListener('scroll', () => {
    if (!isTyping()) restore();
  });
}
