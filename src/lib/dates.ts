export function isoDateDaysAgo(days: number, now = new Date()): string {
  return new Date(now.getTime() - days * 864e5).toISOString().slice(0, 10);
}
