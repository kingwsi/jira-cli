import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  Clock,
  CalendarDays,
  FileText,
  Search,
  Check,
  Zap,
  Loader2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react'
import { api } from '../api/client'
import { IssueItem, WorklogWeekResponse } from '../types'
import { DatePicker } from './DatePicker'
import { WeekCalendarSkeleton } from './Skeleton'

export interface WorklogIssueOption {
  key: string
  summary: string
  status?: string
  source?: 'logged' | 'assigned' // 本周已填报 / 我名下任务
}

interface WorklogDrawerProps {
  isOpen: boolean
  onClose: () => void
  presetDate?: string // YYYY-MM-DD
  presetIssueKey?: string
  loggedIssues: WorklogIssueOption[] // 本周期已有工时的任务
  onSaved: () => void
}

const HOUR_PRESETS = [0.5, 1, 2, 4, 8]
const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function formatToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return date
}

function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return formatLocalDate(dt)
}

export const WorklogDrawer: React.FC<WorklogDrawerProps> = ({
  isOpen,
  onClose,
  presetDate,
  presetIssueKey,
  loggedIssues,
  onSaved,
}) => {
  const [issueKey, setIssueKey] = useState('')
  const [issueSummary, setIssueSummary] = useState('')
  const [date, setDate] = useState('')
  const [hours, setHours] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 我名下的未完结任务 (可选任务来源之一)
  const [myTasks, setMyTasks] = useState<IssueItem[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)

  // 任务选择下拉
  const [pickerOpen, setPickerOpen] = useState(false)
  const [taskSearchText, setTaskSearchText] = useState('')

  // 本周工时日历数据
  const todayStr = useMemo(() => formatToday(), [])
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => {
    return formatLocalDate(getMonday(new Date()))
  })
  const [weekData, setWeekData] = useState<WorklogWeekResponse | null>(null)
  const [loadingWeekData, setLoadingWeekData] = useState(false)

  // 加载指定周的工时数据
  const loadWeekData = (startStr: string) => {
    setLoadingWeekData(true)
    api
      .getWorklogWeek(startStr, 'currentUser()')
      .then((res) => {
        setWeekData(res)
      })
      .catch((err) => {
        console.error('加载周工时失败:', err)
      })
      .finally(() => {
        setLoadingWeekData(false)
      })
  }

  useEffect(() => {
    if (!isOpen) return
    const initialDate = presetDate || formatToday()
    setIssueKey(presetIssueKey || '')
    setTaskSearchText('')
    setPickerOpen(false)
    setDate(initialDate)
    setHours('')
    setComment('')
    setError(null)

    // 计算选中日期所在周的周一
    const [y, m, d] = initialDate.split('-').map(Number)
    const weekMon = formatLocalDate(getMonday(new Date(y, m - 1, d)))
    setCalendarWeekStart(weekMon)
    loadWeekData(weekMon)

    // 同步显示预选任务的概要
    if (presetIssueKey) {
      const found =
        loggedIssues.find((o) => o.key === presetIssueKey) ||
        myTasks.find((t) => t.key === presetIssueKey)
      setIssueSummary(found?.summary || '')
    } else {
      setIssueSummary('')
    }

    // 拉取我的未完结任务，供选择
    setLoadingTasks(true)
    api
      .getIssues({
        jql: "assignee = currentUser() AND statusCategory != 'Done' ORDER BY updated DESC",
      })
      .then((items) => setMyTasks(items || []))
      .catch(() => setMyTasks([]))
      .finally(() => setLoadingTasks(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, presetDate, presetIssueKey])

  // 选择任务后同步概要
  useEffect(() => {
    if (!issueKey) {
      setIssueSummary('')
      return
    }
    const upper = issueKey.toUpperCase()
    const foundTask = myTasks.find((t) => t.key === upper)
    const foundOpt = loggedIssues.find((o) => o.key === upper)
    setIssueSummary(foundTask?.summary || foundOpt?.summary || '')
  }, [issueKey, loggedIssues, myTasks])

  // 可选任务合并去重：本周已填报 + 我名下未完结
  const taskOptions = useMemo(() => {
    const map = new Map<string, WorklogIssueOption>()
    for (const t of myTasks) {
      map.set(t.key, { key: t.key, summary: t.summary, status: t.status, source: 'assigned' })
    }
    for (const o of loggedIssues) {
      if (!map.has(o.key)) {
        map.set(o.key, { ...o })
      }
    }
    let list = Array.from(map.values())

    const q = taskSearchText.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (o) => o.key.toLowerCase().includes(q) || o.summary.toLowerCase().includes(q)
      )
    }
    // 纯文本搜索时允许直接使用输入内容作为任务 Key
    const manualValid =
      q &&
      !list.some((o) => o.key.toLowerCase() === q) &&
      /^([a-z]+-)?\d+$/i.test(taskSearchText.trim())
    return { list, manualValid }
  }, [myTasks, loggedIssues, taskSearchText])

  // 当前选中日期的工时记录明细
  const selectedDateLogs = useMemo(() => {
    if (!weekData || !date) return []
    const list: { key: string; summary: string; hoursStr: string; seconds: number }[] = []
    for (const row of weekData.rows || []) {
      const sec = row.dailySpentSeconds?.[date] || 0
      if (sec > 0) {
        list.push({
          key: row.issueKey,
          summary: row.issueSummary,
          hoursStr: `${(sec / 3600).toFixed(1)}h`,
          seconds: sec,
        })
      }
    }
    return list
  }, [weekData, date])

  const selectedDateTotalSeconds = useMemo(() => {
    if (!weekData || !date) return 0
    return weekData.dailyTotalsSeconds?.[date] || 0
  }, [weekData, date])
  const selectedDateTotalHoursStr = (selectedDateTotalSeconds / 3600).toFixed(1)

  // 切换日历周
  const handlePrevWeek = () => {
    const newStart = addDaysStr(calendarWeekStart, -7)
    setCalendarWeekStart(newStart)
    loadWeekData(newStart)
  }

  const handleNextWeek = () => {
    const newStart = addDaysStr(calendarWeekStart, 7)
    setCalendarWeekStart(newStart)
    loadWeekData(newStart)
  }

  const handleCurrentWeek = () => {
    const weekMon = formatLocalDate(getMonday(new Date()))
    setCalendarWeekStart(weekMon)
    loadWeekData(weekMon)
  }

  if (!isOpen) return null

  const normalizeTimeSpent = (raw: string): string | null => {
    const cleaned = raw.trim().toLowerCase().replace(/h$/, '').trim()
    if (!cleaned) return null
    const num = Number(cleaned)
    if (!Number.isFinite(num) || num <= 0 || num > 24) return null
    return `${num}h`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const spent = normalizeTimeSpent(hours)
    if (!issueKey.trim()) {
      setError('请选择或填写任务')
      return
    }
    if (!spent) {
      setError('请填写有效工时 (0.5 ~ 24 小时)')
      return
    }
    if (!date) {
      setError('请选择填报日期')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await api.addWorklog({
        issueKey: issueKey.trim().toUpperCase(),
        timeSpent: spent,
        started: date,
        comment: comment.trim() || undefined,
      })
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message || '登记失败')
    } finally {
      setSaving(false)
    }
  }

  const sourceBadge = (source?: string) =>
    source === 'logged' ? (
      <span
        style={{
          fontSize: '9.5px',
          padding: '0 5px',
          borderRadius: '8px',
          fontWeight: 700,
          backgroundColor: '#eae6ff',
          color: '#403294',
          border: '1px solid #c0b6f2',
        }}
      >
        本周已报
      </span>
    ) : (
      <span
        style={{
          fontSize: '9.5px',
          padding: '0 5px',
          borderRadius: '8px',
          fontWeight: 700,
          backgroundColor: '#e3fcef',
          color: '#006644',
          border: '1px solid #abf5d1',
        }}
      >
        我的任务
      </span>
    )

  const totalWeekHoursStr = weekData
    ? `${((weekData.totalSpentSeconds || 0) / 3600).toFixed(1)}h`
    : '0.0h'

  return (
    <>
      <div data-ui="modal-backdrop" onClick={onClose} />
      <div data-ui="drawer-content" style={{ width: '480px', maxWidth: '95vw' }}>
        <div data-ui="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={16} color="var(--color-primary)" />
            <span style={{ fontSize: '15px', fontWeight: 700 }}>填报工时</span>
            {presetDate && (
              <span
                style={{
                  fontSize: '11px',
                  backgroundColor: 'rgba(9, 30, 66, 0.08)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  color: 'var(--text-secondary)',
                }}
              >
                {date}
              </span>
            )}
          </div>
          <button data-ui="button" data-variant="ghost" onClick={onClose} style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div data-ui="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-danger-subtle)',
                  color: 'var(--color-danger)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                }}
              >
                {error}
              </div>
            )}

            {/* ========== 本周已记录工时日历面板 ========== */}
            {loadingWeekData || !weekData ? (
              <WeekCalendarSkeleton />
            ) : (
              <div
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {/* 日历顶栏：周导航与工时统计 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} color="var(--color-primary)" />
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>
                      {weekData ? `${weekData.weekStart.slice(5)} ~ ${weekData.weekEnd.slice(5)}` : '本周工时'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
                      <button
                        type="button"
                        data-ui="button"
                        data-size="sm"
                        data-variant="ghost"
                        onClick={handlePrevWeek}
                        style={{ padding: '2px 4px', height: '22px' }}
                        title="上一周"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <button
                        type="button"
                        data-ui="button"
                        data-size="sm"
                        data-variant="ghost"
                        onClick={handleNextWeek}
                        style={{ padding: '2px 4px', height: '22px' }}
                        title="下一周"
                      >
                        <ChevronRight size={13} />
                      </button>
                      {calendarWeekStart !== formatLocalDate(getMonday(new Date())) && (
                        <button
                          type="button"
                          data-ui="button"
                          data-size="sm"
                          data-variant="secondary"
                          onClick={handleCurrentWeek}
                          style={{ padding: '1px 6px', fontSize: '11px', height: '20px' }}
                        >
                          本周
                        </button>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: (weekData?.totalSpentSeconds || 0) >= 40 * 3600 ? '#006644' : 'var(--text-secondary)',
                      backgroundColor:
                        (weekData?.totalSpentSeconds || 0) >= 40 * 3600 ? '#e3fcef' : 'rgba(9, 30, 66, 0.05)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                    }}
                  >
                    已记录 <strong>{totalWeekHoursStr}</strong>
                  </div>
                </div>

                {/* 7 天日历网格 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                  {weekData?.days.map((day) => {
                    const isSelected = date === day.date
                    const isToday = day.date === todayStr
                    const totalSec = weekData.dailyTotalsSeconds?.[day.date] || 0
                    const hoursNum = Math.round((totalSec / 3600) * 10) / 10
                    const isPastWorkday = day.isPast && day.weekday !== 0 && day.weekday !== 6

                    // 徽章颜色
                    let badgeBg = '#f4f5f7'
                    let badgeColor = 'var(--text-muted)'
                    let badgeBorder = '#dfe1e6'

                    if (hoursNum >= 8) {
                      badgeBg = '#e3fcef'
                      badgeColor = '#006644'
                      badgeBorder = '#abf5d1'
                    } else if (hoursNum > 0) {
                      badgeBg = '#fff0b3'
                      badgeColor = '#7a4100'
                      badgeBorder = '#ffe380'
                    } else if (isPastWorkday) {
                      badgeBg = '#ffebe6'
                      badgeColor = '#de350b'
                      badgeBorder = '#ffbdad'
                    }

                    return (
                      <div
                        key={day.date}
                        onClick={() => setDate(day.date)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px 2px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          backgroundColor: isSelected
                            ? '#ebf5ff'
                            : isToday
                            ? 'rgba(0, 82, 204, 0.04)'
                            : 'var(--bg-input)',
                          border: isSelected
                            ? '2px solid var(--color-primary)'
                            : isToday
                            ? '1px solid #b3d4ff'
                            : '1px solid var(--border-default)',
                          transition: 'all 0.15s ease',
                        }}
                        title={`${day.date} (${WEEKDAY_NAMES[day.weekday]}) - 已记录 ${hoursNum}h`}
                      >
                        <div
                          style={{
                            fontSize: '11px',
                            color: day.weekday === 0 || day.weekday === 6 ? '#de350b' : 'var(--text-muted)',
                            fontWeight: 500,
                            marginBottom: '2px',
                          }}
                        >
                          {['日', '一', '二', '三', '四', '五', '六'][day.weekday]}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: isToday || isSelected ? 700 : 500,
                            color: isToday ? 'var(--color-primary)' : 'var(--text-primary)',
                            marginBottom: '4px',
                          }}
                        >
                          {day.date.slice(8)}
                        </div>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 600,
                            padding: '1px 3px',
                            borderRadius: '4px',
                            backgroundColor: badgeBg,
                            color: badgeColor,
                            border: `1px solid ${badgeBorder}`,
                            whiteSpace: 'nowrap',
                            lineHeight: '1.2',
                          }}
                        >
                          {hoursNum > 0 ? `${hoursNum}h` : isPastWorkday ? '缺' : '0h'}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* 选中当天的工时明细快捷提示 */}
                {selectedDateLogs.length > 0 ? (
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'rgba(9, 30, 66, 0.04)',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>{date} 已记录工时明细:</span>
                      <span style={{ color: 'var(--color-primary)' }}>共 {selectedDateTotalHoursStr}h</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                      {selectedDateLogs.map((log) => (
                        <div
                          key={log.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '11px',
                          }}
                        >
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '320px',
                            }}
                          >
                            <b style={{ color: 'var(--color-primary)' }}>{log.key}</b> {log.summary}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                            {log.hoursStr}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      padding: '4px',
                    }}
                  >
                    {date} 暂无工时记录（点击上方日期可快速切换填报日期）
                  </div>
                )}
              </div>
            )}

            {/* ========== 任务选择 Combobox ========== */}
            <div data-ui="form-group" style={{ marginBottom: 0 }}>
              <label data-ui="form-label">
                <FileText size={12} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
                关联任务 *
              </label>

              <div style={{ position: 'relative' }}>
                {/* 已选任务的展示框 */}
                <div
                  onClick={() => {
                    setPickerOpen(true)
                    setTaskSearchText('')
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minHeight: '36px',
                    padding: '6px 10px',
                    border: `1px solid ${pickerOpen ? 'var(--color-primary)' : 'var(--border-default)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    boxShadow: pickerOpen ? 'var(--focus-ring)' : 'none',
                    backgroundColor: 'var(--bg-input)',
                  }}
                >
                  {issueKey ? (
                    <>
                      <span
                        style={{
                          fontWeight: 700,
                          color: 'var(--color-primary)',
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {issueKey}
                      </span>
                      <span
                        style={{
                          fontSize: '12.5px',
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                        title={issueSummary}
                      >
                        {issueSummary || '(新任务，提交时自动匹配概要)'}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', flex: 1 }}>
                      点击从「我的任务」或本周已填报记录中选择...
                    </span>
                  )}
                  <Search size={13} color="var(--text-muted)" />
                </div>

                {/* 下拉浮层 */}
                {pickerOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                      zIndex: 120,
                      display: 'flex',
                      flexDirection: 'column',
                      maxHeight: '260px',
                    }}
                  >
                    <div style={{ position: 'relative', padding: '8px 8px 4px', flexShrink: 0 }}>
                      <Search
                        size={13}
                        style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-muted)' }}
                      />
                      <input
                        data-ui="input"
                        autoFocus
                        placeholder="搜索任务 Key 或概要..."
                        value={taskSearchText}
                        onChange={(e) => setTaskSearchText(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        style={{ paddingLeft: '28px', height: '30px', fontSize: '12px', width: '100%' }}
                      />
                    </div>

                    <div
                      style={{
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        padding: '4px 8px 8px',
                      }}
                    >
                      {loadingTasks && (
                        <div
                          style={{
                            padding: '10px',
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            textAlign: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                          }}
                        >
                          <Loader2 size={13} className="vbg-spinner" />
                          正在加载我的任务...
                        </div>
                      )}

                      {!loadingTasks && taskOptions.list.length === 0 && !taskOptions.manualValid && (
                        <div
                          style={{
                            padding: '10px',
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            textAlign: 'center',
                          }}
                        >
                          没有匹配的任务，可关闭列表后手动输入 Key
                        </div>
                      )}

                      {taskOptions.list.map((opt) => {
                        const isSelected = opt.key.toUpperCase() === issueKey.toUpperCase()
                        return (
                          <div
                            key={opt.key}
                            onClick={() => {
                              setIssueKey(opt.key)
                              setPickerOpen(false)
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '6px 8px',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              fontSize: '12.5px',
                              backgroundColor: isSelected ? '#e9f2ff' : 'transparent',
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: '11px',
                                minWidth: '78px',
                                whiteSpace: 'nowrap',
                                textDecoration: 'underline',
                                textUnderlineOffset: '2px',
                                color: opt.status ? 'var(--color-primary)' : '#403294',
                              }}
                            >
                              {opt.key}
                            </span>
                            <span
                              style={{
                                color: 'var(--text-secondary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                              }}
                              title={`${opt.key} ${opt.summary}`}
                            >
                              {opt.summary}
                            </span>
                            {opt.status && (
                              <span data-ui="tag" style={{ fontSize: '9.5px', padding: '0 5px', flexShrink: 0 }}>
                                {opt.status}
                              </span>
                            )}
                            {sourceBadge(opt.source)}
                            {isSelected && <Check size={13} color="var(--color-primary)" />}
                          </div>
                        )
                      })}

                      {/* 手动使用输入的 Key */}
                      {taskOptions.manualValid && (
                        <div
                          onClick={() => {
                            setIssueKey(taskSearchText.trim().toUpperCase())
                            setPickerOpen(false)
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '7px 8px',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            borderTop: '1px solid var(--border-default)',
                            marginTop: '2px',
                          }}
                        >
                          <Plus size={12} color="var(--color-primary)" />
                          <span>
                            使用 <b style={{ color: 'var(--color-primary)' }}>{taskSearchText.trim().toUpperCase()}</b> 作为任务 Key
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ========== 日期 + 工时行 ========== */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div data-ui="form-group" style={{ marginBottom: 0 }}>
                <label data-ui="form-label">
                  <CalendarDays size={12} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
                  填报日期 *
                </label>
                <DatePicker value={date} onChange={setDate} placeholder="选择填报日期" />
              </div>

              <div data-ui="form-group" style={{ marginBottom: 0 }}>
                <label data-ui="form-label">工作时长 * (小时)</label>
                <input
                  data-ui="input"
                  inputMode="decimal"
                  placeholder="例如: 8 或 3.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {HOUR_PRESETS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      data-ui="button"
                      data-variant={hours === String(h) ? 'primary' : 'secondary'}
                      data-size="sm"
                      onClick={() => setHours(String(h))}
                      title={`填入 ${h} 小时`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '11px',
                        padding: '2px 6px',
                      }}
                    >
                      <Zap size={10} />
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ========== 备注 ========== */}
            <div data-ui="form-group" style={{ marginBottom: 0 }}>
              <label data-ui="form-label">备注说明</label>
              <textarea
                data-ui="textarea"
                placeholder="今天做了什么..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={{ minHeight: '80px' }}
              />
            </div>
          </div>

          <div data-ui="drawer-footer">
            <button type="button" data-ui="button" onClick={onClose}>
              取消
            </button>
            <button type="submit" data-ui="button" data-variant="primary" disabled={saving}>
              {saving ? '提交中...' : '提交工时'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
