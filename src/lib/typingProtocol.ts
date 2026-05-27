/**
 * 打字完成打卡协议
 *
 * TypingPage 通关后发出信号 → Dashboard/StreakWidget 接收后点亮日历
 */

const CHECKIN_KEY = 'devenglish_checkin_dates'

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** 获取所有已打卡的日期 key 集合 */
export function getCheckinDates(): Set<string> {
  try {
    const raw = localStorage.getItem(CHECKIN_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw))
  } catch {
    return new Set()
  }
}

/** 标记今天已打卡 */
export function markTodayCheckin() {
  const dates = getCheckinDates()
  dates.add(todayKey())
  localStorage.setItem(CHECKIN_KEY, JSON.stringify([...dates]))
  window.dispatchEvent(new CustomEvent('devenglish-checkin'))
}

/** 检查今天是否已打卡 */
export function isTodayCheckedIn(): boolean {
  return getCheckinDates().has(todayKey())
}

/** 监听打卡事件 */
export function listenCheckin(callback: () => void) {
  const handler = () => callback()
  window.addEventListener('devenglish-checkin', handler)
  return () => window.removeEventListener('devenglish-checkin', handler)
}
