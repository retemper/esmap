/**
 * Type guard that checks whether a value is a plain object (Record).
 * Excludes non-plain objects such as Array, Date, RegExp, etc.
 * @param value - value to check
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
