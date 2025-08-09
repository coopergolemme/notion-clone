export function toPgVector(vec: number[] | string | null | undefined): string | null {
  if (!vec) return null;
  if (typeof vec === 'string') return vec;
  if (Array.isArray(vec)) return `[${vec.join(',')}]`;
  return null;
}
