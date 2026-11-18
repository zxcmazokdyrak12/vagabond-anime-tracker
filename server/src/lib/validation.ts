export const STATUSES = ['watching', 'completed', 'planning', 'dropped'] as const
export type Status = (typeof STATUSES)[number]

export const isStatus = (v: unknown): v is Status => typeof v === 'string' && STATUSES.includes(v as Status)
export const isPositiveInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0
export const isNonNegativeInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0
export const isValidScore = (v: number | null): boolean => v === null || (Number.isInteger(v) && v >= 1 && v <= 10)

/** '' / null / undefined → null, остальное → Number (NaN отсеет валидация) */
export const toIntOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v)

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Дата вида 2026-11-18, существующая в календаре */
export const isIsoDate = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v)
}
