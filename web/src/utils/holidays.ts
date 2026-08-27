/**
 * 中国大陆法定节假日与调休补班日引擎
 * 数据源：自动同步官方维护的开源项目 NateScarlet/holiday-cn (https://github.com/NateScarlet/holiday-cn)
 * 支持：动态从 GitHub/CDN 拉取最新年份数据 + 本地 LocalStorage 缓存 + 离线兜底降级
 */

export interface DayHolidayInfo {
  dateStr: string // YYYY-MM-DD
  day: number
  dayOfWeek: number // 0-6 (0=周日, 6=周六)
  isWeekend: boolean
  isToday: boolean
  isWorkday: boolean // 实际是否为工作日 (考虑了法定节假日和周末调休补班)
  isHoliday: boolean // 是否为法定休假日 (即使是工作日也放假)
  isTransferWorkday: boolean // 是否为周末调休补班 (周末也要上班)
  holidayName?: string // 节日名称，如 "国庆节"、"春节"、"中秋节"、"元旦" 等
}

interface HolidayCnDay {
  name: string
  date: string // YYYY-MM-DD
  isOffDay: boolean // true 为放假，false 为调休补班
}

interface HolidayCnResponse {
  year: number
  days: HolidayCnDay[]
}

// 内存中缓存已加载的年份数据: year -> { statutory: Record<dateStr, name>, transfer: Record<dateStr, name> }
const holidayCache: Record<
  number,
  { statutory: Record<string, string>; transfer: Record<string, string> }
> = {}

// 离线兜底放假数据表 (防止内网/无网络环境完全不可用)
const FALLBACK_STATUTORY: Record<string, string> = {
  // 2024
  '2024-01-01': '元旦', '2024-02-10': '春节', '2024-02-11': '春节', '2024-02-12': '春节',
  '2024-02-13': '春节', '2024-02-14': '春节', '2024-02-15': '春节', '2024-02-16': '春节',
  '2024-02-17': '春节', '2024-04-04': '清明节', '2024-04-05': '清明节', '2024-04-06': '清明节',
  '2024-05-01': '劳动节', '2024-05-02': '劳动节', '2024-05-03': '劳动节', '2024-05-04': '劳动节',
  '2024-05-05': '劳动节', '2024-06-10': '端午节', '2024-09-15': '中秋节', '2024-09-16': '中秋节',
  '2024-09-17': '中秋节', '2024-10-01': '国庆节', '2024-10-02': '国庆节', '2024-10-03': '国庆节',
  '2024-10-04': '国庆节', '2024-10-05': '国庆节', '2024-10-06': '国庆节', '2024-10-07': '国庆节',

  // 2025
  '2025-01-01': '元旦', '2025-01-28': '除夕', '2025-01-29': '春节', '2025-01-30': '春节',
  '2025-01-31': '春节', '2025-02-01': '春节', '2025-02-02': '春节', '2025-02-03': '春节',
  '2025-02-04': '春节', '2025-04-04': '清明节', '2025-04-05': '清明节', '2025-04-06': '清明节',
  '2025-05-01': '劳动节', '2025-05-02': '劳动节', '2025-05-03': '劳动节', '2025-05-04': '劳动节',
  '2025-05-05': '劳动节', '2025-05-31': '端午节', '2025-06-01': '端午节', '2025-06-02': '端午节',
  '2025-10-01': '国庆中秋', '2025-10-02': '国庆中秋', '2025-10-03': '国庆中秋', '2025-10-04': '国庆中秋',
  '2025-10-05': '国庆中秋', '2025-10-06': '国庆中秋', '2025-10-07': '国庆中秋', '2025-10-08': '国庆中秋',

  // 2026
  '2026-01-01': '元旦', '2026-01-02': '元旦', '2026-01-03': '元旦',
  '2026-02-16': '除夕', '2026-02-17': '春节', '2026-02-18': '春节', '2026-02-19': '春节',
  '2026-02-20': '春节', '2026-02-21': '春节', '2026-02-22': '春节', '2026-02-23': '春节',
  '2026-04-04': '清明节', '2026-04-05': '清明节', '2026-04-06': '清明节',
  '2026-05-01': '劳动节', '2026-05-02': '劳动节', '2026-05-03': '劳动节', '2026-05-04': '劳动节',
  '2026-05-05': '劳动节', '2026-06-19': '端午节', '2026-06-20': '端午节', '2026-06-21': '端午节',
  '2026-09-25': '中秋节', '2026-09-26': '中秋节', '2026-09-27': '中秋节',
  '2026-10-01': '国庆节', '2026-10-02': '国庆节', '2026-10-03': '国庆节', '2026-10-04': '国庆节',
  '2026-10-05': '国庆节', '2026-10-06': '国庆节', '2026-10-07': '国庆节',
}

// 离线兜底调休补班数据表
const FALLBACK_TRANSFER: Record<string, string> = {
  // 2024
  '2024-02-04': '春节调休', '2024-02-18': '春节调休', '2024-04-07': '清明调休',
  '2024-04-28': '劳动节调休', '2024-05-11': '劳动节调休', '2024-09-14': '中秋调休',
  '2024-09-29': '国庆调休', '2024-10-12': '国庆调休',

  // 2025
  '2025-01-26': '春节调休', '2025-02-08': '春节调休', '2025-04-27': '劳动节调休',
  '2025-09-28': '国庆调休', '2025-10-11': '国庆调休',

  // 2026
  '2026-01-04': '元旦调休', '2026-02-15': '春节调休', '2026-02-28': '春节调休',
  '2026-04-26': '劳动节调休', '2026-05-09': '劳动节调休', '2026-09-20': '中秋调休',
  '2026-09-27': '国庆调休', '2026-10-10': '国庆调休',
}

/**
 * 确保加载某一年的法定节假日数据（优先从缓存，其次从 holiday-cn 开源仓库/CDN 拉取）
 */
export async function syncHolidaysFromRemote(year: number): Promise<boolean> {
  const cacheKey = `holiday_cn_${year}`

  // 1. 检查 localStorage
  const saved = localStorage.getItem(cacheKey)
  if (saved) {
    try {
      const parsed: HolidayCnResponse = JSON.parse(saved)
      if (parsed && Array.isArray(parsed.days)) {
        applyHolidayDays(year, parsed.days)
        return true
      }
    } catch (_) {}
  }

  // 2. 尝试从 holiday-cn 开源仓库 CDN 动态拉取
  const cdnUrls = [
    `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`,
    `https://testingcf.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`,
    `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`,
  ]

  for (const url of cdnUrls) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (res.ok) {
        const data: HolidayCnResponse = await res.json()
        if (data && Array.isArray(data.days)) {
          localStorage.setItem(cacheKey, JSON.stringify(data))
          applyHolidayDays(year, data.days)
          return true
        }
      }
    } catch (_) {
      // 切换下一个 CDN 尝试
    }
  }

  return false
}

function applyHolidayDays(year: number, days: HolidayCnDay[]) {
  const statutory: Record<string, string> = {}
  const transfer: Record<string, string> = {}

  days.forEach((item) => {
    if (item.isOffDay) {
      statutory[item.date] = item.name
    } else {
      transfer[item.date] = `${item.name}调休`
    }
  })

  holidayCache[year] = { statutory, transfer }
}

/**
 * 获取指定月份的所有日期元数据
 */
export function getMonthDaysWithHolidays(yearMonthStr: string): DayHolidayInfo[] {
  const [yearStr, monthStr] = yearMonthStr.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) // 1-12
  const totalDays = new Date(year, month, 0).getDate()

  const todayStr = new Date().toISOString().split('T')[0]
  const result: DayHolidayInfo[] = []

  // 如果内存中还没有初始化该年份数据，尝试从 localStorage 读取
  if (!holidayCache[year]) {
    const saved = localStorage.getItem(`holiday_cn_${year}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed?.days) applyHolidayDays(year, parsed.days)
      } catch (_) {}
    }
  }

  const cached = holidayCache[year]
  const statutoryMap = cached ? cached.statutory : FALLBACK_STATUTORY
  const transferMap = cached ? cached.transfer : FALLBACK_TRANSFER

  for (let d = 1; d <= totalDays; d++) {
    const dateObj = new Date(year, month - 1, d)
    const dateStr = `${yearMonthStr}-${String(d).padStart(2, '0')}`
    const dayOfWeek = dateObj.getDay() // 0=日, 6=六
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isToday = dateStr === todayStr

    const holidayName = statutoryMap[dateStr]
    const isHoliday = !!holidayName
    const isTransferWorkday = !!transferMap[dateStr]

    // 实际工作日判定：
    // 1. 周末调休补班 -> 属于工作日
    // 2. 法定假日放假 -> 不属于工作日
    // 3. 其他情况：非周末为工作日，周末为非工作日
    let isWorkday = !isWeekend
    if (isTransferWorkday) {
      isWorkday = true
    } else if (isHoliday) {
      isWorkday = false
    }

    result.push({
      dateStr,
      day: d,
      dayOfWeek,
      isWeekend,
      isToday,
      isWorkday,
      isHoliday,
      isTransferWorkday,
      holidayName: holidayName || (isTransferWorkday ? transferMap[dateStr] : undefined),
    })
  }

  return result
}
