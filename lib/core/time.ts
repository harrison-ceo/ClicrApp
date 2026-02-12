export function getTodayWindow() {
  const now = new Date()
  return { start: now, end: now }
}
