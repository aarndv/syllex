const DAY_MS = 24 * 60 * 60 * 1000;

export function parseLocalCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

export function getDaysUntil(value: string, now: Date): number | null {
  if (/^\d+$/.test(value)) return Number(value);
  const target = parseLocalCalendarDate(value);
  if (!target) return null;

  const todayDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.max(0, Math.round((targetDay - todayDay) / DAY_MS));
}

export function getTrimesterPercent(startValue: string, endValue: string, now: Date): number | null {
  const start = parseLocalCalendarDate(startValue);
  const end = parseLocalCalendarDate(endValue);
  if (!start || !end || end < start) return null;

  // The selected end date is included; progress reaches 100% at the next local midnight.
  const endExclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
  const percent = Math.round(((now.getTime() - start.getTime()) /
    (endExclusive.getTime() - start.getTime())) * 100);
  return Math.min(100, Math.max(0, percent));
}
