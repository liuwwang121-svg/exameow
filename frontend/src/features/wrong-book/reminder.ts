export function shouldShowDailyReminder(dueCount: number, lastShownDate: string | null, today: string): boolean {
  return dueCount > 0 && lastShownDate !== today
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
