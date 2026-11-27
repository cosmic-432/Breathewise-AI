let fallbackSequence = 0;

/**
 * Generates a collision-resistant local identifier with a domain prefix.
 * Uses Web Crypto `randomUUID()` when available and falls back to timestamp + counter.
 */
export function createEntityId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  fallbackSequence += 1;
  return `${prefix}-${Date.now()}-${fallbackSequence}`;
}
