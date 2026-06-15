/** Extracts a display-friendly hostname (without "www.") from a URL string. */
export function getDomain(url?: string): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).hostname.replace(/^www\./, '');
  } catch {
    try {
      return new URL(`https://${trimmed}`).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }
}

/** Ensures a URL has a protocol so it can be used safely in an <a href>. */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
