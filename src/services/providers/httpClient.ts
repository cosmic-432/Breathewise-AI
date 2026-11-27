export const FETCH_TIMEOUT_MS = 8500;

export async function fetchWithTimeout(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } finally {
    clearTimeout(timer);
  }
}

export function toNumberOrNull(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
    return Number(val.toFixed(1));
  }
  return null;
}

/**
 * Produces a concise, non-sensitive diagnostic reason from an unknown error.
 * Never includes query strings or token values.
 */
export function formatSafeErrorReason(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'request timed out';
  }
  if (error instanceof Error) {
    return error.message.replace(/token=[^&\s]+/gi, 'token=[redacted]');
  }
  return 'unexpected provider failure';
}
