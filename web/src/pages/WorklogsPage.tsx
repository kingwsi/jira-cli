import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Calendar,
  User,
  Briefcase,
  Clock,
  ExternalLink,
  Search,
  Check,
  ChevronDown,
  Plus,
} from 'lucide-react'
import { api } from '../api/client'
import { WorklogMatrixResponse, WorklogWeekResponse } from '../types'
import { TaskDrawer } from '../components/TaskDrawer'
import { WorklogDrawer } from '../components/WorklogDrawer'
import { WorklogsSkeleton } from '../components/Skeleton'
import {
  getRangeDaysWithHolidays,
  syncHolidaysFromRemote,
  DayHolidayInfo,
  formatLocalDate,
} from '../utils/holidays'

const EXPECTED_HOURS_PER_DAY = 8
const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']
const WEEK_DAY_PX = 84 // 周视图每格宽度：需要承载当天核对状态
const MONTH_DAY_PX = 40 // 月视图与规划页保持一致的严格 40px 网格

/** 获取给定日期所在周的周一 */
function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return date
}

function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return formatLocalDate(new Date(y, m - 1, d + n))
}

/** 与规划页一致的工时格式化 */
function formatHours(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0h'
  const hours = seconds / 3600
  if (hours > 0 && hours < 0.1) return '0.1h'
  const rounded = Math.round(hours * 10) / 10
  return `${rounded}h`
}

type ReviewTone = 'ok' | 'partial' | 'missing' | 'rest-overtime' | 'rest' | 'upcoming'

interface DayReview {
  tone: ReviewTone
  label: string
  hours: number
}

/** 与规划页每日压力徽章完全同源的配色体系 */
const REVIEW_TONE_STYLES: Record<ReviewTone, { text: string; bg: string; border: string }> = {
  ok: { text: '#006644', bg: '#e3fcef', border: '#abf5d1' },
  partial: { text: '#7a4100', bg: '#fff0b3', border: '#ffe380' },
  missing: { text: '#de350b', bg: '#ffebe6', border: '#ffbdad' },
  'rest-overtime': { text: '#403294', bg: '#eae6ff', border: '#c0b6f2' },
  rest: { text: 'var(--text-muted)', bg: 'transparent', border: 'transparent' },
  upcoming: { text: 'var(--text-muted)', bg: 'rgba(9, 30, 66, 0.04)', border: 'transparent' },
}

/** 月视图每格的简化核对状态 (无目标概念，只区分已填/未填/未来) */
function computeMonthReview(d: DayHolidayInfo, seconds?: number): DayReview {
  const hours = Math.round(((seconds || 0) / 3600) * 10) / 10
  if (hours > 0 && !d.isWorkday) {
    return { tone: 'rest-overtime', label: `${d.holidayName || '非工作日'}加班`, hours }
  }
  if (!d.isWorkday) {
    return { tone: 'rest', label: d.holidayName ? '假期休息' : '休息', hours }
  }
  if (d.dateStr > formatLocalDate(new Date())) {
    return { tone: 'upcoming', label: '未到', hours }
  }
  if (hours === 0) {
    return { tone: 'missing', label: d.isToday ? '今日待填' : '未填写', hours }
  }
  if (hours < EXPECTED_HOURS_PER_DAY) {
    return { tone: 'partial', label: '工时不足', hours }
  }
  return { tone: 'ok', label: '达标', hours }
}

export const WorklogsPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [weekStart, setWeekStart] = useState(() => formatLocalDate(getMonday(new Date())))
  const [currentMonth, setCurrentMonth] = useState(() => formatLocalDate(new Date()).slice(0, 7))

  const [weekData, setWeekData] = useState<WorklogWeekResponse | null>(null)
  const [matrixData, setMatrixData] = useState<WorklogMatrixResponse | null>(null)
  const [loading, setLoading] = useState(false)

  // 人员过滤: 'me' 仅我的工时 | '' 全部成员 | 具体成员 username/displayName
  const [assigneeFilter, setAssigneeFilter] = useState<'me' | '' | string>('me')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null)

  const [quickOpen, setQuickOpen] = useState(false)
  const [presetDate, setPresetDate] = useState<string>(formatLocalDate(new Date()))
  const [presetIssueKey, setPresetIssueKey] = useState<string>('')

  // 人员下拉搜索（与规划页一致的交互）
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [userSearchText, setUserSearchText] = useState('')
  const [remoteUsers, setRemoteUsers] = useState<any[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const userDropdownRef = useRef<HTMLDivElement>(null)

  // 节假日远程同步信号
  const [holidayVersion, setHolidayVersion] = useState(0)
  const syncedYearsRef = useRef<Set<number>>(new Set())

  /* ---------------- 节假日同步 ---------------- */

  useEffect(() => {
    const years =
      viewMode === 'week'
        ? Array.from(new Set([Number(weekStart.slice(0, 4)), Number(addDaysStr(weekStart, 6).slice(0, 4))]))
        : [Number(currentMonth.slice(0, 4))]

    Promise.all(
      years.map((year) => {
        if (syncedYearsRef.current.has(year)) return Promise.resolve()
        syncedYearsRef.current.add(year)
        return syncHolidaysFromRemote(year).catch(() => undefined)
      })
    ).then(() => setHolidayVersion((v) => v + 1))
  }, [viewMode, weekStart, currentMonth])

  /* ---------------- 数据加载 ---------------- */

  const loadData = () => {
    setLoading(true)
    const req =
      viewMode === 'week'
        ? api.getWorklogWeek(weekStart, mapAuthorParam(assigneeFilter)).then(setWeekData)
        : api.getWorklogMatrix(currentMonth, mapAuthorParam(assigneeFilter)).then(setMatrixData)
    req.catch((err) => console.error('加载工时失败:', err)).finally(() => setLoading(false))
  }

  useEffect(loadData, [viewMode, weekStart, currentMonth, assigneeFilter])

  function mapAuthorParam(filter: 'me' | '' | string): string {
    if (filter === 'me') return 'currentUser()'
    if (filter === '') return 'all'
    return filter
  }

  /* ---------------- 远程成员防抖搜索 ---------------- */

  useEffect(() => {
    if (!userDropdownOpen) return

    const timer = setTimeout(() => {
      setSearchingUsers(true)
      api
        .searchUsers(userSearchText.trim())
        .then((res) => setRemoteUsers(res || []))
        .catch(() => setRemoteUsers([]))
        .finally(() => setSearchingUsers(false))
    }, 200)

    return () => clearTimeout(timer)
  }, [userDropdownOpen, userSearchText])

  // 点击外部自动收起下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false)
      }
    }
    if (userDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userDropdownOpen])

  const currentSelectedUserLabel = useMemo(() => {
    if (assigneeFilter === 'me') return '仅我的工时'
    if (assigneeFilter === '') return '全部成员'
    const found =
      remoteUsers.find(
        (u) => u.name === assigneeFilter || u.displayName === assigneeFilter
      ) || null
    return found ? found.displayName || found.name : assigneeFilter
  }, [assigneeFilter, remoteUsers])

  /* ---------------- 导航 ---------------- */

  const handlePrev = () =>
    viewMode === 'week' ? setWeekStart(addDaysStr(weekStart, -7)) : shiftMonth(-1)
  const handleNext = () =>
    viewMode === 'week' ? setWeekStart(addDaysStr(weekStart, 7)) : shiftMonth(1)

  const shiftMonth = (delta: number) => {
    const [y, m] = currentMonth.split('-').map(Number)
    const target = new Date(y, m - 1 + delta, 1)
    setCurrentMonth(`${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`)
  }

  const handleToday = () => {
    const now = new Date()
    setWeekStart(formatLocalDate(getMonday(now)))
    setCurrentMonth(formatLocalDate(now).slice(0, 7))
  }

  const openQuickLog = (date?: string, issueKey?: string) => {
    setPresetDate(date || formatLocalDate(new Date()))
    setPresetIssueKey(issueKey || '')
    setQuickOpen(true)
  }

  /* ---------------- 日期元数据 ---------------- */

  const weekDaysInfo = useMemo(
    () => {
      void holidayVersion
      return getRangeDaysWithHolidays(weekStart, 7)
    },
    [weekStart, holidayVersion]
  )

  const monthDaysInfo = useMemo(
    () => {
      void holidayVersion
      const [y, m] = currentMonth.split('-').map(Number)
      const totalDays = new Date(y, m, 0).getDate()
      return getRangeDaysWithHolidays(`${currentMonth}-01`, totalDays)
    },
    [currentMonth, holidayVersion]
  )

  const activeDaysMeta = viewMode === 'week' ? weekDaysInfo : monthDaysInfo
  const dayPx = viewMode === 'week' ? WEEK_DAY_PX : MONTH_DAY_PX
  const trackWidth = activeDaysMeta.length * dayPx

  /* ---------------- 统计 ---------------- */

  const periodStats = useMemo(() => {
    const workdays = activeDaysMeta.filter((d) => d.isWorkday).length
    const holidays = activeDaysMeta.filter((d) => d.isHoliday).length
    const transfers = activeDaysMeta.filter((d) => d.isTransferWorkday).length
    return { workdays, holidays, transfers }
  }, [activeDaysMeta])

  const activeData = viewMode === 'week' ? weekData : matrixData
  const totalSpentSeconds = activeData?.totalSpentSeconds || 0
  // 目标仅对单人视图有意义
  const hasTarget = assigneeFilter !== ''
  const expectedHours = periodStats.workdays * EXPECTED_HOURS_PER_DAY
  const totalHoursRounded = Math.round((totalSpentSeconds / 3600) * 10) / 10
  const coveragePercent =
    expectedHours > 0 ? Math.min(Math.round((totalHoursRounded / expectedHours) * 100), 100) : 100
  const isEnough = totalHoursRounded >= expectedHours

  /* ---------------- 每日核对 (周视图) ---------------- */

  const todayStr = formatLocalDate(new Date())
  const weekReviewByDay = useMemo(() => {
    const map: Record<string, DayReview> = {}
    if (!weekData) return map

    for (const info of weekDaysInfo) {
      const hours = Math.round(((weekData.dailyTotalsSeconds[info.dateStr] || 0) / 3600) * 10) / 10

      if (!info.isWorkday) {
        map[info.dateStr] =
          hours > 0
            ? {
                tone: 'rest-overtime',
                label: `${info.holidayName || (info.dayOfWeek === 0 || info.dayOfWeek === 6 ? '周末' : '')}加班`,
                hours,
              }
            : { tone: 'rest', label: info.holidayName ? '假期休息' : '休息', hours }
        continue
      }

      if (info.dateStr > todayStr) {
        map[info.dateStr] = { tone: 'upcoming', label: '未到', hours }
        continue
      }

      if (hours === 0) {
        map[info.dateStr] = { tone: 'missing', label: info.isToday ? '今日待填' : '未填写', hours }
      } else if (hours < EXPECTED_HOURS_PER_DAY) {
        map[info.dateStr] = { tone: 'partial', label: info.isToday ? '今日进行中' : '工时不足', hours }
      } else {
        map[info.dateStr] = { tone: 'ok', label: '达标', hours }
      }
    }
    return map
  }, [weekData, weekDaysInfo, todayStr])

  const weekProblemDates = useMemo(
    () =>
      Object.entries(weekReviewByDay)
        .filter(([_, r]) => r.tone === 'missing' || r.tone === 'partial')
        .sort(([a], [b]) => a.localeCompare(b)),
    [weekReviewByDay]
  )
  const allGood = weekProblemDates.length === 0 && Object.keys(weekReviewByDay).length > 0

  /* ---------------- 行数据 ---------------- */

  const rowsSource = activeData?.rows || []
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rowsSource
    const q = searchQuery.toLowerCase()
    return rowsSource.filter(
      (r) =>
        r.issueKey.toLowerCase().includes(q) ||
        r.issueSummary.toLowerCase().includes(q) ||
        (r.assigneeName && r.assigneeName.toLowerCase().includes(q))
    )
  }, [rowsSource, searchQuery])

  // 本周期已填报的任务 (供填报抽屉选择，带"本周已报"标识)
  const loggedIssueOptions = useMemo(
    () => rowsSource.map((r) => ({ key: r.issueKey, summary: r.issueSummary, source: 'logged' as const })),
    [rowsSource]
  )

  /* ============================ 渲染 ============================ */

  const periodLabel =
    viewMode === 'week'
      ? `${weekStart.slice(5).replace('-', '/')} ~ ${addDaysStr(weekStart, 6).slice(5).replace('-', '/')}`
      : currentMonth.replace('-', '年') + '月'

  const isAtCurrentPeriod =
    viewMode === 'week'
      ? weekStart === formatLocalDate(getMonday(new Date()))
      : currentMonth === formatLocalDate(new Date()).slice(0, 7)

  /** 行右侧每个日期格子的展示值 */
  const cellToneStyle = (tone: ReviewTone) => REVIEW_TONE_STYLES[tone]

  const renderCellHours = (
    seconds: number | undefined,
    review?: DayReview
  ): React.ReactNode => {
    const hours = seconds ? Math.round((seconds / 3600) * 10) / 10 : 0
    if (hours <= 0) {
      const showMissing = review && (review.tone === 'missing')
      return (
        <span style={{ color: showMissing ? 'var(--color-danger)' : '#dfe1e6', fontSize: '11px' }}>
          {showMissing ? '0' : '-'}
        </span>
      )
    }
    // 有填值的格子统一绿色，非工作日加班用紫色与规划页一致
    const overtime = review?.tone === 'rest-overtime'
    return (
      <span
        style={{
          backgroundColor: overtime ? '#eae6ff' : 'var(--bg-success-subtle)',
          color: overtime ? '#403294' : 'var(--color-success)',
          border: `1px solid ${overtime ? '#c0b6f2' : 'var(--border-success)'}`,
          padding: '1px 5px',
          borderRadius: '10px',
          fontWeight: 700,
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
        }}
      >
        {formatHours(hours * 3600)}
      </span>
    )
  }

  return (
    <div data-ui="page-content" data-page="worklogs" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* ==================== 顶部工具栏 (与规划页一致的结构) ==================== */}
      <div
        data-ui="page-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div data-ui="toolbar-main" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* 视图切换 */}
          <div
            data-ui="toolbar-segmented"
            style={{
              display: 'inline-flex',
              backgroundColor: 'var(--bg-surface-dim)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px',
              gap: '2px',
            }}
          >
            {(['week', 'month'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-xs)',
                  transition: 'all 0.15s ease',
                  backgroundColor: viewMode === m ? 'var(--bg-surface)' : 'transparent',
                  color: viewMode === m ? 'var(--color-primary)' : 'var(--text-muted)',
                  boxShadow: viewMode === m ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {m === 'week' ? '周视图' : '月视图'}
              </button>
            ))}
          </div>

          {/* 周期切换器 */}
          <div data-ui="toolbar-period" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button data-ui="button" data-size="sm" onClick={handlePrev}>
              <ChevronLeft size={14} />
            </button>
            <div
              data-ui="toolbar-control"
              style={{
                fontSize: '13.5px',
                fontWeight: 600,
                padding: '4px 12px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Calendar size={14} color="var(--color-primary)" />
              <span>{periodLabel}</span>
              {viewMode === 'week' && (
                <span
                  style={{
                    fontSize: '11px',
                    backgroundColor: 'rgba(9, 30, 66, 0.08)',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                  }}
                >
                  {getISOWeekNumber(weekStart)} 周
                </span>
              )}
            </div>
            <button data-ui="button" data-size="sm" onClick={handleNext}>
              <ChevronRight size={14} />
            </button>
            <button
              data-ui="button"
              data-variant="secondary"
              data-size="sm"
              onClick={handleToday}
              disabled={isAtCurrentPeriod}
              style={{ marginLeft: '2px' }}
            >
              本{viewMode === 'week' ? '周' : '月'}
            </button>
          </div>

          {/* 工作日与节假日统计徽章 (与规划页同款) */}
          <div
            data-ui="toolbar-control"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <Briefcase size={13} color="var(--color-primary)" />
            <span>
              应填报 <strong>{periodStats.workdays}</strong> 个工作日
              {periodStats.holidays > 0 && (
                <span style={{ color: '#de350b', marginLeft: '4px' }}>(法定假 {periodStats.holidays} 天)</span>
              )}
              {periodStats.transfers > 0 && (
                <span style={{ color: '#ff8b00', marginLeft: '4px' }}>(调休班 {periodStats.transfers} 天)</span>
              )}
            </span>
          </div>

          {/* 核对进度徽章 (绿/红双色，同规划页预估覆盖徽章) */}
          <div
            data-ui="toolbar-control"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: hasTarget ? (isEnough ? '#006644' : '#974f0c') : 'var(--text-secondary)',
              backgroundColor: hasTarget ? (isEnough ? '#e3fcef' : '#fff7d6') : 'var(--bg-surface-dim)',
              border: `1px solid ${
                hasTarget ? (isEnough ? '#abf5d1' : '#f5cd47') : 'var(--border-default)'
              }`,
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
            }}
            title={
              hasTarget
                ? `目标 = ${periodStats.workdays} 个工作日 × ${EXPECTED_HOURS_PER_DAY}h = ${expectedHours}h；${
                    isEnough ? '工时足额' : `尚差 ${Math.max(expectedHours - totalHoursRounded, 0).toFixed(1)}h`
                  }`
                : '全部成员工时为汇总视图，不设个人目标'
            }
          >
            <Clock size={13} />
            <span>
              已报 <strong>{totalHoursRounded}h</strong>
              {hasTarget && (
                <>
                  {' / '}目标 {expectedHours}h{' · '}
                  <strong>{coveragePercent}%</strong>
                </>
              )}
            </span>
          </div>

          {viewMode === 'week' &&
            (allGood ? (
              <div
                data-ui="toolbar-control"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#006644',
                  backgroundColor: '#e3fcef',
                  border: '1px solid #abf5d1',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <Check size={13} />
                <span>逐日核对通过</span>
              </div>
            ) : weekProblemDates.length > 0 ? (
              <div
                data-ui="toolbar-control"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#bf2600',
                  backgroundColor: '#ffebe6',
                  border: '1px solid #ffbdad',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                }}
                title="点击对应日期快速补录"
              >
                <span>待补:</span>
                {weekProblemDates.map(([dateStr]) => (
                  <span
                    key={dateStr}
                    onClick={() => openQuickLog(dateStr)}
                    style={{
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      textUnderlineOffset: '2px',
                      fontWeight: 700,
                      fontSize: '11.5px',
                      backgroundColor: '#ffffff',
                      borderRadius: '10px',
                      padding: '0 6px',
                      border: '1px solid #ffbdad',
                    }}
                  >
                    {dateStr.slice(5).replace('-', '/')}
                  </span>
                ))}
              </div>
            ) : null)}

          {/* 统一人员选择器 Combobox (与规划页一致) */}
          <div ref={userDropdownRef} style={{ position: 'relative' }}>
            <button
              data-ui="button"
              data-variant="secondary"
              onClick={() => {
                setUserDropdownOpen((v) => !v)
                if (!userDropdownOpen) setUserSearchText('')
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                fontSize: '12.5px',
                fontWeight: 600,
                backgroundColor: assigneeFilter === 'me' ? '#e3fcef' : 'var(--bg-surface)',
                borderColor: assigneeFilter === 'me' ? '#abf5d1' : 'var(--border-default)',
                color: assigneeFilter === 'me' ? '#006644' : 'var(--text-primary)',
              }}
              title="切换/搜索过滤人员"
            >
              <User size={13} color={assigneeFilter === 'me' ? '#00875a' : 'var(--color-primary)'} />
              <span>{currentSelectedUserLabel}</span>
              <ChevronDown
                size={13}
                style={{
                  opacity: 0.6,
                  transform: userDropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}
              />
            </button>

            {userDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  width: '260px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                  zIndex: 100,
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={13} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
                  <input
                    data-ui="input"
                    autoFocus
                    placeholder="搜索成员姓名 / 用户名..."
                    value={userSearchText}
                    onChange={(e) => setUserSearchText(e.target.value)}
                    style={{
                      paddingLeft: '28px',
                      paddingRight: '8px',
                      fontSize: '12px',
                      height: '30px',
                      width: '100%',
                    }}
                  />
                </div>

                {!userSearchText && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      paddingBottom: '4px',
                      borderBottom: '1px solid var(--border-default)',
                    }}
                  >
                    <UserOptionRow
                      label="👤 仅我的工时"
                      isSelected={assigneeFilter === 'me'}
                      onClick={() => {
                        setAssigneeFilter('me')
                        setUserDropdownOpen(false)
                      }}
                    />
                    <UserOptionRow
                      label="👥 全部成员"
                      isSelected={assigneeFilter === ''}
                      onClick={() => {
                        setAssigneeFilter('')
                        setUserDropdownOpen(false)
                      }}
                    />
                  </div>
                )}

                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {searchingUsers && (
                    <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      正在搜索 Jira 成员...
                    </div>
                  )}

                  {!searchingUsers && remoteUsers.length === 0 && (
                    <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      {userSearchText ? '未找到匹配成员' : '暂无成员'}
                    </div>
                  )}

                  {!searchingUsers &&
                    remoteUsers.map((u) => {
                      const userVal = u.name || u.displayName
                      const isSelected = assigneeFilter === userVal || assigneeFilter === u.displayName
                      return (
                        <div
                          key={u.name || u.key || u.displayName}
                          onClick={() => {
                            setAssigneeFilter(userVal)
                            setUserDropdownOpen(false)
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontSize: '12.5px',
                            backgroundColor: isSelected ? 'var(--bg-surface-hover)' : 'transparent',
                            fontWeight: isSelected ? 600 : 400,
                            color: isSelected ? 'var(--color-primary)' : 'inherit',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: '#0052cc',
                                color: '#fff',
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 600,
                              }}
                            >
                              {(u.displayName || u.name || 'U').charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <div>{u.displayName}</div>
                              {u.name && u.name !== u.displayName && (
                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>@{u.name}</div>
                              )}
                            </div>
                          </div>
                          {isSelected && <Check size={14} />}
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>

          {/* 搜索框 */}
          <div data-ui="search-input" style={{ width: '200px' }}>
            <Search size={14} />
            <input
              data-ui="input"
              placeholder="搜索 Key 或任务概要..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ height: '32px', fontSize: '12px' }}
            />
          </div>
        </div>

        {/* 右侧操作区 */}
        <div data-ui="toolbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            data-ui="button"
            data-variant="primary"
            onClick={() => openQuickLog()}
            title="登记一条工作日志"
          >
            <Plus size={14} />
            <span>填报工时</span>
          </button>
          <button data-ui="button" onClick={loadData}>
            <RotateCcw size={14} className={loading ? 'vbg-spinner' : ''} />
            <span>刷新</span>
          </button>
        </div>
      </div>

      {/* ==================== 一体化 Sticky 工时矩阵 (复用规划页甘特架构) ==================== */}
      <div data-ui="gantt-container">
        <div data-ui="gantt-viewport">
          {/* 表头区 */}
          <div data-ui="gantt-header-row">
            {/* 第一层：日期标头 */}
            <div data-ui="gantt-header-date-row">
              <div data-ui="gantt-title-col">
                <span>{viewMode === 'week' ? '本周工时明细' : '当月工时明细'}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>共 {filteredRows.length} 项</span>
              </div>

              <div data-ui="gantt-days-track" style={{ minWidth: `${trackWidth}px` }}>
                {activeDaysMeta.map((d) => (
                  <div
                    key={d.dateStr}
                    data-ui="gantt-day-col"
                    className={`
                      ${d.isHoliday ? 'holiday' : d.isTransferWorkday ? 'transfer-workday' : d.isWeekend ? 'weekend' : ''}
                      ${d.isToday ? 'today' : ''}
                    `}
                    style={{ width: `${dayPx}px` }}
                    title={
                      d.holidayName
                        ? `${d.dateStr} ${d.holidayName} (${d.isHoliday ? '法定放假' : '调休上班'})`
                        : `${d.dateStr} 周${WEEKDAY_NAMES[d.dayOfWeek]}`
                    }
                  >
                    <span style={{ fontWeight: 700 }}>{d.day}</span>
                    <span style={{ fontSize: '9px', opacity: 0.8 }}>周{WEEKDAY_NAMES[d.dayOfWeek]}</span>
                    {d.isHoliday && (
                      <span data-ui="holiday-tag" className="holiday">
                        {d.holidayName ? d.holidayName.slice(0, 2) : '休'}
                      </span>
                    )}
                    {d.isTransferWorkday && (
                      <span data-ui="holiday-tag" className="workday">
                        班
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 第二层：每日填报核对状态行 */}
            <div data-ui="gantt-review-row">
              <div data-ui="gantt-title-col" className="review-title-col">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={13} color="var(--color-primary)" />
                  <span style={{ fontWeight: 600, fontSize: '11.5px', color: 'var(--text-primary)' }}>每日核对</span>
                </div>
                {/* 颜色图例 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#36b37e' }} />
                    达标
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ffab00' }} />
                    不足
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ff5630' }} />
                    缺填
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#8777d9' }} />
                    加班
                  </span>
                </div>
              </div>

              <div data-ui="gantt-days-track" style={{ minWidth: `${trackWidth}px` }}>
                {activeDaysMeta.map((d) => {
                  const review =
                    viewMode === 'week'
                      ? weekReviewByDay[d.dateStr]
                      : computeMonthReview(
                          d,
                          matrixData?.rows.reduce(
                            (acc, r) => acc + (r.dailySpentSeconds[d.dateStr] || 0),
                            0
                          )
                        )
                  const tone = review?.tone || 'upcoming'
                  const ts = cellToneStyle(tone)
                  return (
                    <div
                      key={d.dateStr}
                      data-ui="gantt-review-col"
                      className={`
                        ${d.isHoliday ? 'holiday' : d.isTransferWorkday ? 'transfer-workday' : d.isWeekend ? 'weekend' : ''}
                        ${d.isToday ? 'today' : ''}
                      `}
                      style={{ width: `${dayPx}px` }}
                      onClick={() => openQuickLog(d.dateStr)}
                      title={review ? `${d.dateStr} ${review.label}${review.hours > 0 ? ` (${formatHours(review.hours * 3600)})` : ''} · 点击补录` : `${d.dateStr}`}
                    >
                      {review && (
                        <span
                          className="review-status-chip"
                          style={{
                            backgroundColor: ts.bg,
                            color: ts.text,
                            borderColor: ts.border,
                          }}
                        >
                          {ts.bg === 'transparent' ? (
                            <>
                              <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: '#b3bac5', marginRight: 4 }} />
                              休
                            </>
                          ) : (
                            <>
                              {review.hours > 0 && `${formatHours(review.hours * 3600).replace(/\.0$/, '')} · `}
                              {shortLabel(review.label)}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 数据行 */}
          {loading ? (
            <div style={{ padding: '12px' }}>
              <WorklogsSkeleton />
            </div>
          ) : (
            <>
              {filteredRows.map((row, index) => {
                const isEven = index % 2 === 0
                return (
                  <div key={row.issueKey} data-ui="gantt-row" className={isEven ? 'zebra-even' : 'zebra-odd'}>
                    {/* 左侧固定列 */}
                    <div data-ui="gantt-title-col" onClick={() => setSelectedIssueKey(row.issueKey)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: 'var(--color-primary)',
                            fontSize: '11.5px',
                            minWidth: '82px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            cursor: 'pointer',
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedIssueKey(row.issueKey)
                          }}
                          title={`查看 ${row.issueKey} 详情`}
                        >
                          <span style={{ textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                            {row.issueKey}
                          </span>
                          <ExternalLink size={10} style={{ opacity: 0.65 }} />
                        </span>

                        <span
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 500,
                            color: 'var(--text-secondary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                          title={row.issueSummary}
                        >
                          {row.issueSummary}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              backgroundColor: 'rgba(9, 30, 66, 0.06)',
                              color: 'var(--text-secondary)',
                              fontWeight: 400,
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-xs)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <User size={10} />
                            <span>{row.assigneeName || '未指派'}</span>
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              backgroundColor: 'rgba(9, 30, 66, 0.06)',
                              color: 'var(--text-secondary)',
                              padding: '1px 6px',
                              borderRadius: 'var(--radius-xs)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              whiteSpace: 'nowrap',
                              fontWeight: 700,
                            }}
                            title={`该任务总工时`}
                          >
                            <Clock size={10} color="var(--color-primary)" />
                            <span>{formatHours(row.totalSpentSeconds)}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 右侧日期格子 */}
                    <div data-ui="gantt-timeline-track" style={{ minWidth: `${trackWidth}px` }}>
                      {activeDaysMeta.map((d) => (
                        <div
                          key={d.dateStr}
                          data-ui="gantt-log-cell"
                          className={`
                            ${d.isHoliday ? 'holiday' : d.isTransferWorkday ? 'transfer-workday' : d.isWeekend ? 'weekend' : ''}
                            ${d.isToday ? 'today' : ''}
                          `}
                          style={{ width: `${dayPx}px` }}
                          onClick={() => openQuickLog(d.dateStr, row.issueKey)}
                          title={`${row.issueKey} · ${d.dateStr}\n点击补充工时`}
                        >
                          {renderCellHours(row.dailySpentSeconds[d.dateStr],
                            viewMode === 'week' ? weekReviewByDay[d.dateStr] : undefined)}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* 当日合计行 (类似规划页的父需求聚合行) */}
              <div data-ui="gantt-row" className="parent-row">
                <div data-ui="gantt-title-col">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: '#403294',
                        fontSize: '12px',
                      }}
                    >
                      当日合计
                    </span>
                    <span
                      style={{
                        fontSize: '10.5px',
                        backgroundColor: 'rgba(64, 50, 148, 0.12)',
                        color: '#403294',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontWeight: 600,
                      }}
                    >
                      周期总计 {formatHours(totalSpentSeconds)}
                    </span>
                  </div>
                </div>
                <div data-ui="gantt-timeline-track" style={{ minWidth: `${trackWidth}px` }}>
                  {activeDaysMeta.map((d) => {
                    const secs =
                      viewMode === 'week'
                        ? weekData?.dailyTotalsSeconds[d.dateStr]
                        : filteredRows.reduce((acc, r) => acc + (r.dailySpentSeconds[d.dateStr] || 0), 0)
                    const hrs = secs ? secs / 3600 : 0
                    const needFill = viewMode === 'week' && d.isWorkday && d.dateStr <= todayStr && hrs === 0
                    return (
                      <div
                        key={d.dateStr}
                        data-ui="gantt-log-cell"
                        className={`total-cell ${d.isToday ? 'today' : ''}`}
                        style={{ width: `${dayPx}px` }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color:
                              hrs > 0
                                ? 'var(--text-primary)'
                                : needFill
                                ? 'var(--color-danger)'
                                : '#b3bac5',
                          }}
                        >
                          {hrs > 0 ? formatHours(secs) : needFill ? '0' : '-'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {filteredRows.length === 0 && (
                <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {searchQuery
                    ? '没有找到匹配的工时记录'
                    : viewMode === 'week'
                    ? '本周暂无工作日志记录，点击「填报工时」或任意日期格开始记录'
                    : '当月暂无工作日志记录'}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 详情抽屉 */}
      <TaskDrawer issueKey={selectedIssueKey} onClose={() => setSelectedIssueKey(null)} onUpdated={loadData} />

      {/* 填报工时抽屉 */}
      <WorklogDrawer
        isOpen={quickOpen}
        onClose={() => setQuickOpen(false)}
        presetDate={presetDate}
        presetIssueKey={presetIssueKey}
        loggedIssues={loggedIssueOptions}
        onSaved={loadData}
      />
    </div>
  )
}

/* ============================================================ */

/** 通用选项行 */
const UserOptionRow: React.FC<{ label: string; isSelected: boolean; onClick: () => void }> = ({
  label,
  isSelected,
  onClick,
}) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 8px',
      borderRadius: 'var(--radius-sm)',
      cursor: 'pointer',
      fontSize: '12.5px',
      backgroundColor: isSelected ? 'var(--bg-surface-hover)' : 'transparent',
      fontWeight: isSelected ? 600 : 400,
      color: isSelected ? 'var(--color-primary)' : 'inherit',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span>{label}</span>
    </div>
    {isSelected && <Check size={14} />}
  </div>
)

/** ISO 周序号 */
function getISOWeekNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/** 状态短语压缩显示 */
function shortLabel(label: string): string {
  if (label.includes('今日待填')) return '待填'
  if (label.includes('今日进行中')) return '进行中'
  if (label.includes('进行中')) return '进行中'
  if (label.includes('不足')) return '不足'
  if (label.includes('未填写')) return '未填'
  if (label.startsWith('达标')) return '达标'
  return label.length > 6 ? label.slice(0, 6) : label
}
