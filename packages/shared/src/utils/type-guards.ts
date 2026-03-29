/**
 * 값이 plain object(Record)인지 확인하는 타입 가드.
 * Array, Date, RegExp 등 non-plain object는 제외한다.
 * @param value - 검증할 값
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
