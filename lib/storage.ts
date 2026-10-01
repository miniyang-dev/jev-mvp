/** Thin localStorage wrappers shared by every client-side store in this app
 * (the Gemini batch job/history, the golden set). Every call is wrapped so
 * private browsing, a full quota, or a corrupted value degrades into "no
 * persistence" instead of crashing the page. */

export function safeGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing, storage quota, etc. — the page still works without persistence.
  }
}

export function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
