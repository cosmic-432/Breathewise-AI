/**
 * Narrowing helpers for union string values from DOM controls (<select>, <input>)
 * and unknown error objects, eliminating unsafe `as` type assertions.
 */

export function isOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
): value is T {
  return (allowed as readonly string[]).includes(value);
}

export function getNumericHttpStatus(err: unknown): number | null {
  if (typeof err !== 'object' || err === null || !('status' in err)) {
    return null;
  }
  const candidate = (err as { status: unknown }).status;
  return typeof candidate === 'number' && Number.isInteger(candidate) ? candidate : null;
}
