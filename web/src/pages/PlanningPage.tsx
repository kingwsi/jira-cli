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
  Activity,
  Sparkles,
} from 'lucide-react'
import { api } from '../api/client'
import { PlanningTreeNode } from '../types'
import { TaskDrawer } from '../components/TaskDrawer'
import { PlanningSkeleton } from '../components/Skeleton'
import { DayHolidayInfo, getMonthDaysWithHolidays, syncHolidaysFromRemote } from '../utils/holidays'
import { getFrequentUsers, loadFrequentUsers, recordUserSelection, UserHistoryItem } from '../utils/recentUsers'

export interface DailyWorkloadTask {
  key: string
  summary: string
  assigneeName?: string
  isMine?: boolean
  issueType: string
  dailyHours: number
  dailyHoursFormatted: string
  totalHoursFormatted: string
  startDate: string
  endDate: string
}

export interface DailyWorkloadItem {
  dateStr: string
  day: number
  dayOfWeek: number
  dayInfo: DayHolidayInfo
  totalHours: number
  roundedHours: number
  hoursFormatted: string
  loadPercent: number
  level: 'empty' | 'light' | 'normal' | 'heavy' | 'danger' | 'overtime'
  levelLabel: string
  levelColor: string
  badgeBg: string
  badgeText: string
  badgeBorder: string
  tasks: DailyWorkloadTask[]
}

interface FlatPlanningRow {
  key: string
  parentKey?: string
  isParent: boolean
  summary: string
  issueType: string
  status: string
  assigneeName?: string
  assigneeUsername?: string
  startDate: string
  endDate: string
  originalEstimateSeconds: number
  timeSpentSeconds: number
  progressPercent: number
  childCount?: number
  isMine?: boolean
}

export const PlanningPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [jiraBaseUrl, setJiraBaseUrl] = useState<string>('')
  const [holidayVersion, setHolidayVersion] = useState(0)

  // 当前月份 YYYY-MM
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // 人员筛选与高亮焦点: 'currentUser()' (默认仅我的任务) | '' (全部成员) | 成员 username / displayName
  const [assigneeFilter, setAssigneeFilter] = useState('currentUser()')
  // 勾选框：是否显示父任务下所有子任务（包含他人协同排期）
  const [includeSiblings, setIncludeSiblings] = useState(true)

  // 远程成员搜索相关状态
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [userSearchText, setUserSearchText] = useState('')
  const [remoteUsers, setRemoteUsers] = useState<any[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [frequentUsers, setFrequentUsers] = useState<UserHistoryItem[]>([])
  const userDropdownRef = useRef<HTMLDivElement>(null)

  // 打开下拉时刷新常用成员历史
  useEffect(() => {
    if (userDropdownOpen) {
      setFrequentUsers(getFrequentUsers(8))
      loadFrequentUsers(8).then(setFrequentUsers).catch(() => { })
    }
  }, [userDropdownOpen])

  const [treeData, setTreeData] = useState<PlanningTreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null)

  // 悬停联动 (父需求与子任务联动高亮)
  const [hoveredParentKey, setHoveredParentKey] = useState<string | null>(null)

  // 悬停气泡 Tooltip 状态
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    row: FlatPlanningRow
    startDate: string
    endDate: string
  } | null>(null)

  // 每日工时压力气泡 Tooltip 状态
  const [pressureTooltip, setPressureTooltip] = useState<{
    x: number
    y: number
    data: DailyWorkloadItem
  } | null>(null)

  const handleShowTooltip = (e: React.MouseEvent, row: FlatPlanningRow, start?: string, end?: string) => {
    // 智能防溢出定位
    let x = e.clientX + 16
    let y = e.clientY + 16
    if (x + 300 > window.innerWidth) {
      x = e.clientX - 305
    }
    if (y + 220 > window.innerHeight) {
      y = e.clientY - 210
    }
    setTooltip({
      x,
      y,
      row,
      startDate: start || '-',
      endDate: end || '-',
    })
  }

  const handleMoveTooltip = (e: React.MouseEvent) => {
    if (!tooltip) return
    let x = e.clientX + 16
    let y = e.clientY + 16
    if (x + 300 > window.innerWidth) {
      x = e.clientX - 305
    }
    if (y + 220 > window.innerHeight) {
      y = e.clientY - 210
    }
    setTooltip((prev) => (prev ? { ...prev, x, y } : null))
  }

  const handleShowPressureTooltip = (e: React.MouseEvent, item: DailyWorkloadItem) => {
    let x = e.clientX + 16
    let y = e.clientY + 16
    if (x + 330 > window.innerWidth) {
      x = e.clientX - 335
    }
    if (y + 300 > window.innerHeight) {
      y = e.clientY - 280
    }
    setPressureTooltip({
      x,
      y,
      data: item,
    })
  }

  const handleMovePressureTooltip = (e: React.MouseEvent) => {
    if (!pressureTooltip) return
    let x = e.clientX + 16
    let y = e.clientY + 16
    if (x + 330 > window.innerWidth) {
      x = e.clientX - 335
    }
    if (y + 300 > window.innerHeight) {
      y = e.clientY - 280
    }
    setPressureTooltip((prev) => (prev ? { ...prev, x, y } : null))
  }

  // 从当前过滤出的子任务与父任务中动态收集所有参与的经办人
  const availableUsers = useMemo(() => {
    const userMap = new Map<string, { key: string; name: string; displayName: string; isCurrent: boolean }>()

    if (currentUser) {
      const curKey = currentUser.name || currentUser.displayName || '__current__'
      userMap.set(curKey, {
        key: curKey,
        name: currentUser.name || '',
        displayName: currentUser.displayName || currentUser.name || '我',
        isCurrent: true,
      })
    }

    treeData.forEach((parent) => {
      if (parent.assignee && parent.assignee.displayName) {
        const k = parent.assignee.displayName
        const isCurrent = currentUser && (
          currentUser.name === parent.assignee.name ||
          currentUser.displayName === parent.assignee.displayName ||
          currentUser.emailAddress === parent.assignee.emailAddress
        )
        if (!userMap.has(k)) {
          userMap.set(k, {
            key: k,
            name: parent.assignee.name,
            displayName: parent.assignee.displayName,
            isCurrent: !!isCurrent,
          })
        }
      }

      parent.children?.forEach((child) => {
        if (child.assignee && child.assignee.displayName) {
          const k = child.assignee.displayName
          const isCurrent = currentUser && (
            currentUser.name === child.assignee.name ||
            currentUser.displayName === child.assignee.displayName ||
            currentUser.emailAddress === child.assignee.emailAddress
          )
          if (!userMap.has(k)) {
            userMap.set(k, {
              key: k,
              name: child.assignee.name,
              displayName: child.assignee.displayName,
              isCurrent: !!isCurrent,
            })
          }
        }
      })
    })

    return Array.from(userMap.values())
  }, [treeData, currentUser])

  // 判定某行是否为当前选中的高亮成员
  const isRowHighlightedUser = (row: FlatPlanningRow) => {
    if (!assigneeFilter) return true // 全部成员模式：全员平权展示，不降对比度
    if (assigneeFilter === 'currentUser()') {
      return !!row.isMine
    }
    return (
      (!!row.assigneeName && row.assigneeName === assigneeFilter) ||
      (!!row.assigneeUsername && row.assigneeUsername === assigneeFilter)
    )
  }

  // 自动从 holiday-cn 开源仓库同步当前年份的法定放假与调休补班数据
  useEffect(() => {
    const year = parseInt(currentMonth.split('-')[0], 10)
    syncHolidaysFromRemote(year).then((updated) => {
      if (updated) {
        setHolidayVersion((v) => v + 1)
      }
    })
  }, [currentMonth])

  // 计算当月天数和日期列表 (接入中国法定节假日与调休补班数据)
  const monthDays = useMemo(() => {
    return getMonthDaysWithHolidays(currentMonth)
  }, [currentMonth, holidayVersion])

  // 当月工作日及休假统计
  const monthStats = useMemo(() => {
    const workdays = monthDays.filter((d) => d.isWorkday).length
    const holidays = monthDays.filter((d) => d.isHoliday).length
    const transfers = monthDays.filter((d) => d.isTransferWorkday).length
    return { workdays, holidays, transfers }
  }, [monthDays])

  // 远程用户防抖搜索
  useEffect(() => {
    if (!userDropdownOpen) return

    const timer = setTimeout(() => {
      setSearchingUsers(true)
      api.searchUsers(userSearchText.trim())
        .then((res) => {
          setRemoteUsers(res || [])
        })
        .catch((err) => {
          console.error('搜索成员失败:', err)
        })
        .finally(() => {
          setSearchingUsers(false)
        })
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userDropdownOpen])

  // 当前选中成员的友好显示文案
  const currentSelectedUserLabel = useMemo(() => {
    if (assigneeFilter === 'currentUser()') {
      return currentUser?.displayName ? `我 (${currentUser.displayName})` : '仅我的任务'
    }
    if (!assigneeFilter) {
      return '全部成员'
    }
    const foundRemote = remoteUsers.find((u) => u.name === assigneeFilter || u.displayName === assigneeFilter)
    if (foundRemote) return foundRemote.displayName || foundRemote.name
    const foundTree = availableUsers.find((u) => u.name === assigneeFilter || u.displayName === assigneeFilter)
    if (foundTree) return foundTree.displayName || foundTree.name
    return assigneeFilter
  }, [assigneeFilter, currentUser, remoteUsers, availableUsers])

  const loadData = () => {
    setLoading(true)
    api.getPlanningTree({
      month: currentMonth,
      assignee: assigneeFilter || undefined,
      includeSiblings: includeSiblings,
    })
      .then((tree) => {
        setTreeData(tree || [])
      })
      .catch((err) => {
        console.error('加载排期失败:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    api.getCurrentUser().then(setCurrentUser).catch(() => { })
    api.getConfig().then((cfg) => {
      if (cfg && cfg.url) {
        setJiraBaseUrl(cfg.url.replace(/\/+$/, ''))
      }
    }).catch(() => { })
  }, [])

  const handleOpenJira = (key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!key) return
    const baseUrl = jiraBaseUrl || window.location.origin
    window.open(`${baseUrl}/browse/${key}`, '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    loadData()
  }, [currentMonth, assigneeFilter, includeSiblings])

  // 展平为统一行序列（同一行内左右一体化）
  const flatRows = useMemo(() => {
    const rows: FlatPlanningRow[] = []

    const isMineUser = (assignee?: any) => {
      if (!assignee || !currentUser) return false
      return (
        assignee.name === currentUser.name ||
        assignee.displayName === currentUser.displayName ||
        assignee.emailAddress === currentUser.emailAddress
      )
    }

    const isMatchFilterUser = (assignee?: any) => {
      if (!assigneeFilter) return true
      if (!assignee) return false
      if (assigneeFilter === 'currentUser()') {
        return isMineUser(assignee)
      }
      return (
        assignee.name === assigneeFilter ||
        assignee.displayName === assigneeFilter
      )
    }

    // 筛选有效父需求
    const filteredParents = treeData.filter((parent) => {
      const isParentMatch = isMatchFilterUser(parent.assignee)
      const hasChildMatch = parent.children?.some((c) => isMatchFilterUser(c.assignee))

      // 如果当前开启了人员过滤，且该父任务及名下没有任何属于该用户的子任务，则直接跳过排除
      if (assigneeFilter && !isParentMatch && !hasChildMatch) {
        return false
      }
      return true
    })

    // 获取父需求用于排序的参考开始日期与结束日期（优先取过滤用户名下子任务的最早开始时间）
    const getParentSortDates = (parent: PlanningTreeNode) => {
      // 1. 查找匹配当前过滤用户的子任务
      const matchingChildren = (parent.children || []).filter((c) =>
        isMatchFilterUser(c.assignee)
      )
      const validChildren = matchingChildren.filter((c) => !!c.startDate)

      if (validChildren.length > 0) {
        const sorted = [...validChildren].sort((a, b) => {
          if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate)
          return (a.endDate || '').localeCompare(b.endDate || '')
        })
        return {
          startDate: sorted[0].startDate,
          endDate: sorted[0].endDate || '',
        }
      }

      // 2. 如果当前过滤用户没有带日期的子任务，但父需求本身匹配且有开始日期
      if (isMatchFilterUser(parent.assignee) && parent.startDate) {
        return {
          startDate: parent.startDate,
          endDate: parent.endDate || '',
        }
      }

      // 3. 如果未指定过滤（全部成员），查找任意子任务的最早开始日期
      if (!assigneeFilter) {
        const allValidChildren = (parent.children || []).filter((c) => !!c.startDate)
        if (allValidChildren.length > 0) {
          const sorted = [...allValidChildren].sort((a, b) => {
            if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate)
            return (a.endDate || '').localeCompare(b.endDate || '')
          })
          return {
            startDate: sorted[0].startDate,
            endDate: sorted[0].endDate || '',
          }
        }
        return {
          startDate: parent.startDate || '',
          endDate: parent.endDate || '',
        }
      }

      return {
        startDate: '',
        endDate: '',
      }
    }

    // 按过滤用户子任务的开始日期升序排序父需求列表
    const sortedParents = [...filteredParents].sort((a, b) => {
      const datesA = getParentSortDates(a)
      const datesB = getParentSortDates(b)

      const startA = datesA.startDate
      const startB = datesB.startDate
      const endA = datesA.endDate
      const endB = datesB.endDate

      if (startA && startB) {
        if (startA !== startB) return startA.localeCompare(startB)
        if (endA !== endB) return (endA || '').localeCompare(endB || '')
        return a.key.localeCompare(b.key)
      }
      if (startA && !startB) return -1
      if (!startA && startB) return 1
      return a.key.localeCompare(b.key)
    })

    sortedParents.forEach((parent) => {
      // 1. 父需求行
      rows.push({
        key: parent.key,
        isParent: true,
        summary: parent.summary,
        issueType: parent.issueType,
        status: parent.status,
        assigneeName: parent.assignee?.displayName,
        assigneeUsername: parent.assignee?.name,
        startDate: parent.startDate,
        endDate: parent.endDate,
        originalEstimateSeconds: parent.originalEstimateSeconds || 0,
        timeSpentSeconds: parent.timeSpentSeconds || 0,
        progressPercent: parent.progressPercent,
        childCount: parent.children?.length || 0,
        isMine: isMineUser(parent.assignee),
      })

      // 2. 子任务行（按开始时间正序升序排列）
      const sortedChildren = [...(parent.children || [])].sort((a, b) => {
        const aStart = a.startDate
        const bStart = b.startDate
        const aEnd = a.endDate
        const bEnd = b.endDate

        if (aStart && bStart) {
          if (aStart !== bStart) return aStart.localeCompare(bStart)
          if (aEnd !== bEnd) return (aEnd || '').localeCompare(bEnd || '')
          return a.key.localeCompare(b.key)
        }
        if (aStart && !bStart) return -1
        if (!aStart && bStart) return 1
        return a.key.localeCompare(b.key)
      })

      sortedChildren.forEach((child) => {
        // 如果未开启“显示协同子任务”，且该子任务不是选中用户的，则过滤掉
        if (assigneeFilter && !includeSiblings && !isMatchFilterUser(child.assignee)) {
          return
        }

        rows.push({
          key: child.key,
          parentKey: parent.key,
          isParent: false,
          summary: child.summary,
          issueType: child.issueType,
          status: child.status,
          assigneeName: child.assignee?.displayName,
          assigneeUsername: child.assignee?.name,
          startDate: child.startDate,
          endDate: child.endDate,
          originalEstimateSeconds: child.originalEstimateSeconds || 0,
          timeSpentSeconds: child.timeSpentSeconds || 0,
          progressPercent: child.progressPercent,
          isMine: isMineUser(child.assignee),
        })
      })
    })

    return rows
  }, [treeData, currentUser, assigneeFilter, includeSiblings])

  // 格式化秒数为易读的小时工时 (例如 28800s -> "8h", 14400s -> "4h")
  const formatHours = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0h'
    const hours = seconds / 3600
    if (hours < 0.1) return '0.1h'
    if (Number.isInteger(hours)) return `${hours}h`
    return `${hours.toFixed(1)}h`
  }

  // 计算当前排期任务的预估工时总和 (换算为 h 和 x天，按 1天 = 8h)
  const estimateStats = useMemo(() => {
    let totalSec = 0
    let focusSec = 0

    flatRows.forEach((row) => {
      if (!row.isParent) {
        const sec = row.originalEstimateSeconds || 0
        totalSec += sec
        if (isRowHighlightedUser(row)) {
          focusSec += sec
        }
      }
    })

    const formatSec = (s: number) => {
      const hours = s / 3600
      const days = hours / 8
      const hoursStr = Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`
      const daysStr = Number.isInteger(days) ? `${days}天` : `${days.toFixed(1)}天`
      return { hoursStr, daysStr, hours, days }
    }

    return {
      total: formatSec(totalSec),
      focus: formatSec(focusSec),
      hasFilter: !!assigneeFilter,
    }
  }, [flatRows, assigneeFilter])

  // 足额目标：当月工作日 × 8h × 75%
  const estimateCoverage = useMemo(() => {
    const targetHours = monthStats.workdays * 8 * 0.75
    const actualHours = estimateStats.hasFilter ? estimateStats.focus.hours : estimateStats.total.hours
    const shortageHours = Math.max(targetHours - actualHours, 0)
    const formatHoursValue = (hours: number) =>
      Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`

    return {
      targetHours,
      isEnough: actualHours >= targetHours,
      coveragePercent: targetHours > 0 ? Math.round((actualHours / targetHours) * 100) : 100,
      targetHoursStr: formatHoursValue(targetHours),
      shortageHoursStr: formatHoursValue(shortageHours),
    }
  }, [estimateStats, monthStats.workdays])

  // 每日工时压力数据统计
  const dailyWorkload = useMemo(() => {
    const dateMap: Record<
      string,
      {
        dayInfo: DayHolidayInfo
        totalHours: number
        tasks: DailyWorkloadTask[]
      }
    > = {}

    monthDays.forEach((d) => {
      dateMap[d.dateStr] = {
        dayInfo: d,
        totalHours: 0,
        tasks: [],
      }
    })

    const isWorkdayStr = (dateStr: string) => {
      if (dateMap[dateStr]) {
        return dateMap[dateStr].dayInfo.isWorkday
      }
      const dt = new Date(dateStr + 'T00:00:00')
      const dow = dt.getDay()
      return dow !== 0 && dow !== 6
    }

    flatRows.forEach((row) => {
      if (row.isParent) return
      // 如果开启了人员筛选，只计算归属于筛选用户的子任务压力
      if (assigneeFilter && !isRowHighlightedUser(row)) {
        return
      }

      if (!row.startDate || !row.endDate) return

      const startClean = row.startDate.split('T')[0]
      const endClean = row.endDate.split('T')[0]

      const [sy, sm, sd] = startClean.split('-').map(Number)
      const [ey, em, ed] = endClean.split('-').map(Number)
      const sDate = new Date(sy, sm - 1, sd)
      const eDate = new Date(ey, em - 1, ed)

      if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || sDate > eDate) return

      const taskDates: string[] = []
      const cur = new Date(sy, sm - 1, sd)
      while (cur <= eDate) {
        const y = cur.getFullYear()
        const m = String(cur.getMonth() + 1).padStart(2, '0')
        const d = String(cur.getDate()).padStart(2, '0')
        taskDates.push(`${y}-${m}-${d}`)
        cur.setDate(cur.getDate() + 1)
      }

      if (taskDates.length === 0) return

      const taskTotalHours = (row.originalEstimateSeconds || 0) / 3600
      const taskWorkdays = taskDates.filter(isWorkdayStr)
      // 若没有工作日（如完全排在周末），则按自然日均分；否则按工作日均分
      const effectiveDays = taskWorkdays.length > 0 ? taskWorkdays : taskDates
      const dailyHours = taskTotalHours > 0 ? taskTotalHours / effectiveDays.length : 0

      effectiveDays.forEach((ds) => {
        if (dateMap[ds]) {
          dateMap[ds].totalHours += dailyHours
          dateMap[ds].tasks.push({
            key: row.key,
            summary: row.summary,
            assigneeName: row.assigneeName,
            isMine: row.isMine,
            issueType: row.issueType,
            dailyHours,
            dailyHoursFormatted: formatHours(dailyHours * 3600),
            totalHoursFormatted: formatHours(row.originalEstimateSeconds),
            startDate: startClean,
            endDate: endClean,
          })
        }
      })
    })

    const list: DailyWorkloadItem[] = monthDays.map((d) => {
      const entry = dateMap[d.dateStr]
      const h = entry ? entry.totalHours : 0
      const tasks = entry ? entry.tasks : []
      const roundedH = Math.round(h * 10) / 10
      const hoursFormatted = formatHours(h * 3600)
      const loadPercent = Math.round((h / 8) * 100)

      let level: DailyWorkloadItem['level'] = 'empty'
      let levelLabel = '空闲 / 无排期'
      let levelColor = '#dfe1e6'
      let badgeBg = 'transparent'
      let badgeText = 'var(--text-muted)'
      let badgeBorder = 'transparent'

      if (h === 0) {
        level = 'empty'
        levelLabel = '空闲 / 无排期'
        levelColor = '#b3bac5'
      } else if (!d.isWorkday) {
        level = 'overtime'
        levelLabel = `非工作日加班 (${hoursFormatted})`
        levelColor = '#8777d9'
        badgeBg = '#eae6ff'
        badgeText = '#403294'
        badgeBorder = '#c0b6f2'
      } else if (h <= 6) {
        level = 'light'
        levelLabel = `适度 / 充裕 (${hoursFormatted})`
        levelColor = '#36b37e'
        badgeBg = '#e3fcef'
        badgeText = '#006644'
        badgeBorder = '#abf5d1'
      } else if (h <= 8.5) {
        level = 'normal'
        levelLabel = `饱和 / 达标 (${hoursFormatted})`
        levelColor = '#0065ff'
        badgeBg = '#deebff'
        badgeText = '#0747a6'
        badgeBorder = '#b3d4ff'
      } else if (h <= 11) {
        level = 'heavy'
        levelLabel = `偏重 / 预警 (${hoursFormatted})`
        levelColor = '#ffab00'
        badgeBg = '#fff0b3'
        badgeText = '#7a4100'
        badgeBorder = '#ffe380'
      } else {
        level = 'danger'
        levelLabel = `严重超载 (${hoursFormatted})`
        levelColor = '#ff5630'
        badgeBg = '#ffebe6'
        badgeText = '#de350b'
        badgeBorder = '#ffbdad'
      }

      return {
        dateStr: d.dateStr,
        day: d.day,
        dayOfWeek: d.dayOfWeek,
        dayInfo: d,
        totalHours: h,
        roundedHours: roundedH,
        hoursFormatted,
        loadPercent,
        level,
        levelLabel,
        levelColor,
        badgeBg,
        badgeText,
        badgeBorder,
        tasks,
      }
    })

    const map: Record<string, DailyWorkloadItem> = {}
    list.forEach((item) => {
      map[item.dateStr] = item
    })

    return { list, map }
  }, [monthDays, flatRows, assigneeFilter, currentUser])

  // 月份切换
  const handlePrevMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number)
    const prevDate = new Date(y, m - 2, 1)
    setCurrentMonth(
      `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    )
  }

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number)
    const nextDate = new Date(y, m, 1)
    setCurrentMonth(
      `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
    )
  }

  // 精准计算排期条在当月时间网格中的像素坐标 (绝对避免跨月/边界错位)
  const getBarStyle = (start?: string, end?: string) => {
    if (!start || !end) return null

    const [cy, cm] = currentMonth.split('-').map(Number)
    const totalDays = monthDays.length
    const monthStartDate = new Date(cy, cm - 1, 1, 0, 0, 0)
    const monthEndDate = new Date(cy, cm - 1, totalDays, 23, 59, 59)

    // 清洗日期格式 (如 2026-08-01T12:00:00 -> 2026-08-01)
    const cleanStart = start.split('T')[0]
    const cleanEnd = end.split('T')[0]

    const sDate = new Date(cleanStart + 'T00:00:00')
    const eDate = new Date(cleanEnd + 'T23:59:59')

    if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) return null

    // 如果完全在当月之前或完全在当月之后
    if (eDate < monthStartDate || sDate > monthEndDate) return null

    // 截取当月内部的有效范围
    const effectiveStart = sDate < monthStartDate ? monthStartDate : sDate
    const effectiveEnd = eDate > monthEndDate ? monthEndDate : eDate

    const startDay = effectiveStart.getDate()
    const endDay = effectiveEnd.getDate()

    const dayWidth = 40 // 每格严格 40px
    const left = (startDay - 1) * dayWidth + 2
    const width = (endDay - startDay + 1) * dayWidth - 4

    return {
      left: `${left}px`,
      width: `${Math.max(width, 24)}px`,
    }
  }

  const trackWidth = monthDays.length * 40

  return (
    <div data-ui="page-content" data-page="planning" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 顶部工具栏 */}
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
          {/* 月份选择器 */}
          <div data-ui="toolbar-period" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button data-ui="button" data-size="sm" onClick={handlePrevMonth}>
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
              <span>{currentMonth}</span>
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
                匹配标题 ~ "{currentMonth.replace('-', '')}"
              </span>
            </div>
            <button data-ui="button" data-size="sm" onClick={handleNextMonth}>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* 工作日与节假日统计徽章 */}
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
              应出勤 <strong>{monthStats.workdays}</strong> 个工作日
              {monthStats.holidays > 0 && (
                <span style={{ color: '#de350b', marginLeft: '4px' }}>
                  (法定假 {monthStats.holidays} 天)
                </span>
              )}
              {monthStats.transfers > 0 && (
                <span style={{ color: '#ff8b00', marginLeft: '4px' }}>
                  (调休班 {monthStats.transfers} 天)
                </span>
              )}
            </span>
          </div>

          {/* 预估 / 目标工时紧凑徽章 */}
          <div
            data-ui="toolbar-control"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: estimateCoverage.isEnough ? '#00875a' : '#974f0c',
              backgroundColor: estimateCoverage.isEnough ? '#e3fcef' : '#fff7d6',
              border: `1px solid ${estimateCoverage.isEnough ? '#abf5d1' : '#f5cd47'}`,
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
            }}
            title={`预估工时 ${estimateStats.hasFilter ? estimateStats.focus.hoursStr : estimateStats.total.hoursStr}；目标 = ${monthStats.workdays} 个工作日 × 8h × 75% = ${estimateCoverage.targetHoursStr}；${estimateCoverage.isEnough ? '已足额' : `尚缺 ${estimateCoverage.shortageHoursStr}`}`}
          >
            <Clock size={13} />
            <span>
              预估 <strong>{estimateStats.hasFilter ? estimateStats.focus.hoursStr : estimateStats.total.hoursStr}</strong>
              {' / '}目标 {estimateCoverage.targetHoursStr}
              {' · '}<strong>{estimateCoverage.coveragePercent}%</strong>
            </span>
          </div>

          {/* 统一人员选择器：支持打字搜索 Jira 全员的 Combobox */}
          <div ref={userDropdownRef} style={{ position: 'relative' }}>
            <button
              data-ui="button"
              data-variant="secondary"
              onClick={() => {
                setUserDropdownOpen((v) => !v)
                if (!userDropdownOpen) {
                  setUserSearchText('')
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                fontSize: '12.5px',
                fontWeight: 600,
                backgroundColor: assigneeFilter ? '#e3fcef' : 'var(--bg-surface)',
                borderColor: assigneeFilter ? '#abf5d1' : 'var(--border-default)',
                color: assigneeFilter ? '#00875a' : 'var(--text-primary)',
              }}
              title="切换/搜索过滤人员"
            >
              <User size={13} color={assigneeFilter ? '#00875a' : 'var(--color-primary)'} />
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

            {/* 弹出式搜索下拉浮层 */}
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
                {/* 搜索框 */}
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

                {/* 快速选项 */}
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
                    <div
                      onClick={() => {
                        setAssigneeFilter('currentUser()')
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
                        backgroundColor: assigneeFilter === 'currentUser()' ? 'var(--bg-surface-hover)' : 'transparent',
                        fontWeight: assigneeFilter === 'currentUser()' ? 600 : 400,
                        color: assigneeFilter === 'currentUser()' ? 'var(--color-primary)' : 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={13} />
                        <span>👤 仅我的任务</span>
                      </div>
                      {assigneeFilter === 'currentUser()' && <Check size={14} />}
                    </div>

                    <div
                      onClick={() => {
                        setAssigneeFilter('')
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
                        backgroundColor: assigneeFilter === '' ? 'var(--bg-surface-hover)' : 'transparent',
                        fontWeight: assigneeFilter === '' ? 600 : 400,
                        color: assigneeFilter === '' ? 'var(--color-primary)' : 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>👥 全部成员</span>
                      </div>
                      {assigneeFilter === '' && <Check size={14} />}
                    </div>

                    {/* 常用成员列表 (来自本地与后端数据库) */}
                    {frequentUsers.length > 0 && (
                      <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
                        <div
                          style={{
                            padding: '3px 8px',
                            fontSize: '10.5px',
                            color: 'var(--text-muted)',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Sparkles size={10} color="var(--color-warning)" />
                          <span>常用成员</span>
                        </div>
                        {frequentUsers.map((fu) => {
                          const isSelected = assigneeFilter === fu.name || assigneeFilter === fu.displayName
                          return (
                            <div
                              key={fu.name}
                              onClick={() => {
                                setAssigneeFilter(fu.name)
                                recordUserSelection(fu)
                                setUserDropdownOpen(false)
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '5px 8px',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                fontSize: '12px',
                                backgroundColor: isSelected ? 'var(--bg-surface-hover)' : 'transparent',
                                fontWeight: isSelected ? 600 : 400,
                                color: isSelected ? 'var(--color-primary)' : 'inherit',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <User size={12} color="var(--color-primary)" />
                                <span>{fu.displayName || fu.name}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isSelected && <Check size={13} />}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 成员列表（来自 Jira 官方搜索） */}
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
                      const freq = frequentUsers.find((f) => f.name === u.name)
                      return (
                        <div
                          key={u.name || u.key || u.displayName}
                          onClick={() => {
                            setAssigneeFilter(userVal)
                            recordUserSelection({
                              name: u.name || userVal,
                              displayName: u.displayName || u.name,
                            })
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {freq && (
                              <span
                                style={{
                                  fontSize: '9px',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  backgroundColor: 'var(--bg-primary-subtle)',
                                  color: 'var(--color-primary)',
                                  fontWeight: 500,
                                }}
                              >
                                常用
                              </span>
                            )}
                            {isSelected && <Check size={14} />}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>

          {/* 勾选框：显示父任务下所有子任务 */}
          <label
            data-ui="toolbar-control"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              userSelect: 'none',
              padding: '5px 12px',
              backgroundColor: includeSiblings ? 'var(--bg-info-subtle)' : 'var(--bg-surface)',
              border: `1px solid ${includeSiblings ? 'var(--border-info)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-sm)',
              color: includeSiblings ? 'var(--color-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="checkbox"
              checked={includeSiblings}
              onChange={(e) => setIncludeSiblings(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
            />
            <span>显示协同子任务</span>
          </label>
        </div>

        {/* 右侧：刷新 */}
        <div data-ui="toolbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button data-ui="button" onClick={loadData}>
            <RotateCcw size={14} />
            <span>刷新</span>
          </button>
        </div>
      </div>

      {/* 一体化 Sticky 甘特图 (同一行一体架构，零上下错位，零左右失步) */}
      <div data-ui="gantt-container">
        <div data-ui="gantt-viewport">
          {/* 表头区 (Sticky Top: 包含日期与每日工时压力指示条) */}
          <div data-ui="gantt-header-row">
            {/* 顶层：日期标头行 */}
            <div data-ui="gantt-header-date-row">
              {/* 左侧固定标题列标头 (Sticky Left) */}
              <div data-ui="gantt-title-col">
                <span>需求与子任务列表</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>共 {flatRows.length} 项</span>
              </div>

              {/* 右侧日期标头 (精细化展示中国法定节假日与调休补班) */}
              <div data-ui="gantt-days-track" style={{ minWidth: `${trackWidth}px` }}>
                {monthDays.map((d) => (
                  <div
                    key={d.day}
                    data-ui="gantt-day-col"
                    className={`
                      ${d.isHoliday ? 'holiday' : d.isTransferWorkday ? 'transfer-workday' : d.isWeekend ? 'weekend' : ''}
                      ${d.isToday ? 'today' : ''}
                    `}
                    title={d.holidayName ? `${d.dateStr} ${d.holidayName} (${d.isHoliday ? '法定放假' : '调休上班'})` : d.dateStr}
                  >
                    <span style={{ fontWeight: 700 }}>{d.day}</span>
                    <span style={{ fontSize: '9px', opacity: 0.8 }}>
                      {['日', '一', '二', '三', '四', '五', '六'][d.dayOfWeek]}
                    </span>
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

            {/* 每日工时压力指示行 (Sticky Top Row 2) */}
            <div data-ui="gantt-header-pressure-row">
              {/* 左侧固定标题列 (Sticky Left) */}
              <div data-ui="gantt-title-col" className="pressure-title-col">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={13} color="var(--color-primary)" />
                  <span style={{ fontWeight: 600, fontSize: '11.5px', color: 'var(--text-primary)' }}>
                    每日工时压力
                  </span>
                  {assigneeFilter && (
                    <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                      ({assigneeFilter === 'currentUser()' ? '我' : currentSelectedUserLabel})
                    </span>
                  )}
                </div>

                {/* 颜色图例 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#36b37e' }} />
                    ≤6h
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#0065ff' }} />
                    8h
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ffab00' }} />
                    10h
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ff5630' }} />
                    &gt;10h
                  </span>
                </div>
              </div>

              {/* 右侧对应每个日期的压力指示格 */}
              <div data-ui="gantt-days-track" style={{ minWidth: `${trackWidth}px` }}>
                {dailyWorkload.list.map((item) => (
                  <div
                    key={item.day}
                    data-ui="gantt-pressure-col"
                    className={`
                      ${item.dayInfo.isHoliday ? 'holiday' : item.dayInfo.isTransferWorkday ? 'transfer-workday' : item.dayInfo.isWeekend ? 'weekend' : ''}
                      ${item.dayInfo.isToday ? 'today' : ''}
                    `}
                    onMouseEnter={(e) => handleShowPressureTooltip(e, item)}
                    onMouseMove={handleMovePressureTooltip}
                    onMouseLeave={() => setPressureTooltip(null)}
                  >
                    {item.totalHours > 0 ? (
                      <span
                        data-ui="pressure-pill"
                        style={{
                          backgroundColor: item.badgeBg,
                          color: item.badgeText,
                          borderColor: item.badgeBorder,
                        }}
                      >
                        {item.hoursFormatted}
                      </span>
                    ) : (
                      <span
                        data-ui="pressure-empty-dot"
                        style={{
                          backgroundColor:
                            item.dayInfo.isWeekend && !item.dayInfo.isTransferWorkday
                              ? 'rgba(9, 30, 66, 0.04)'
                              : 'rgba(9, 30, 66, 0.12)',
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 数据行渲染 */}
          {loading ? (
            <div style={{ padding: '12px' }}>
              <PlanningSkeleton />
            </div>
          ) : (
            <>
              {flatRows.map((row, index) => {
                const isEven = index % 2 === 0
                const isBug = row.issueType.toLowerCase() === 'bug'
                const pKey = row.parentKey || row.key
                const isHighlighted = hoveredParentKey === pKey

                const rowStart = row.startDate
                const rowEnd = row.endDate
                const barStyle = getBarStyle(rowStart, rowEnd)

                // 焦点高亮与暗化判断
                const isFocusUser = isRowHighlightedUser(row)
                const isDimmed = !row.isParent && !isFocusUser && !!assigneeFilter

                return (
                  <div
                    key={row.key}
                    data-ui="gantt-row"
                    className={`
                      ${row.isParent ? 'parent-row' : isEven ? 'zebra-even' : 'zebra-odd'}
                      ${isHighlighted ? 'row-hovered' : ''}
                    `}
                    onMouseEnter={() => setHoveredParentKey(pKey)}
                    onMouseLeave={() => setHoveredParentKey(null)}
                  >
                    {/* 左侧固定内容列 (Sticky Left) */}
                    <div
                      data-ui="gantt-title-col"
                      style={{
                        paddingLeft: row.isParent ? '16px' : '36px',
                        cursor: 'pointer',
                        opacity: isDimmed ? 0.65 : 1,
                      }}
                      onClick={() => setSelectedIssueKey(row.key)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        {/* Key (支持点击在新标签页打开 Jira 详情页) */}
                        <span
                          style={{
                            fontWeight: 700,
                            color: row.isParent
                              ? '#403294'
                              : isBug
                                ? 'var(--color-danger)'
                                : 'var(--color-primary)',
                            fontSize: '11.5px',
                            minWidth: '82px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            cursor: 'pointer',
                          }}
                          onClick={(e) => handleOpenJira(row.key, e)}
                          title={`点击在 Jira 中打开 ${row.key}`}
                        >
                          <span style={{ textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                            {row.key}
                          </span>
                          <ExternalLink size={10} style={{ opacity: 0.65 }} />
                        </span>

                        {/* 概要 */}
                        <span
                          style={{
                            fontSize: '12.5px',
                            fontWeight: row.isParent ? 600 : 500,
                            color: row.isParent ? 'var(--text-primary)' : 'var(--text-secondary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                          title={row.summary}
                        >
                          {row.summary}
                        </span>

                        {/* 父节点数量提示 or 子节点负责人标签与工时 */}
                        {row.isParent ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {row.childCount && row.childCount > 0 ? (
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  backgroundColor: 'rgba(64, 50, 148, 0.12)',
                                  color: '#403294',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {row.childCount} 子任务
                              </span>
                            ) : null}
                            {row.originalEstimateSeconds > 0 && (
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  backgroundColor: 'rgba(64, 50, 148, 0.08)',
                                  color: '#403294',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                总预估 {formatHours(row.originalEstimateSeconds)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                backgroundColor: isFocusUser ? '#e3fcef' : 'rgba(9, 30, 66, 0.06)',
                                color: isFocusUser ? '#00875a' : 'var(--text-secondary)',
                                border: isFocusUser ? '1px solid #abf5d1' : '1px solid transparent',
                                fontWeight: isFocusUser ? 700 : 400,
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-xs)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <User size={10} />
                              <span>{row.isMine ? `我 (${row.assigneeName || '当前用户'})` : (row.assigneeName || '未指派')}</span>
                            </span>

                            {/* 任务评估工时徽章 */}
                            {row.originalEstimateSeconds > 0 && (
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
                                  fontWeight: 600,
                                }}
                                title={`评估工时: ${formatHours(row.originalEstimateSeconds)}${row.timeSpentSeconds > 0 ? ` (已耗时: ${formatHours(row.timeSpentSeconds)})` : ''}`}
                              >
                                <Clock size={10} color="var(--color-primary)" />
                                <span>{formatHours(row.originalEstimateSeconds)}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 右侧甘特时间线轨道 */}
                    <div data-ui="gantt-timeline-track" style={{ minWidth: `${trackWidth}px` }}>
                      {/* 背景垂直网格线 */}
                      <div data-ui="gantt-row-grid">
                        {monthDays.map((d) => (
                          <div
                            key={d.day}
                            data-ui="gantt-grid-cell"
                            className={`
                              ${d.isHoliday ? 'holiday' : d.isTransferWorkday ? 'transfer-workday' : d.isWeekend ? 'weekend' : ''}
                              ${d.isToday ? 'today' : ''}
                            `}
                          />
                        ))}
                      </div>

                      {/* 甘特排期条：选中的高亮成员展示为绿色 my-task，其他成员暗化降权 */}
                      {barStyle ? (
                        <div
                          data-ui="gantt-bar-wrapper"
                          className={isDimmed ? 'dimmed' : ''}
                          data-type={row.isParent ? 'parent' : isFocusUser ? 'my-task' : isBug ? 'bug' : 'other-task'}
                          style={{
                            ...barStyle,
                            ...(isHighlighted
                              ? {
                                boxShadow: '0 0 0 2px #ffab00, 0 4px 14px rgba(255, 171, 0, 0.5)',
                                zIndex: 15,
                              }
                              : {}),
                          }}
                          onClick={() => setSelectedIssueKey(row.key)}
                          onMouseEnter={(e) => handleShowTooltip(e, row, rowStart, rowEnd)}
                          onMouseMove={handleMoveTooltip}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.key} {row.summary}
                          </span>
                        </div>
                      ) : (
                        !row.isParent && (
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              paddingLeft: '16px',
                              cursor: 'pointer',
                              zIndex: 6,
                              display: 'flex',
                              alignItems: 'center',
                              height: '100%',
                              opacity: isDimmed ? 0.4 : 1,
                            }}
                            onClick={() => setSelectedIssueKey(row.key)}
                            onMouseEnter={(e) => handleShowTooltip(e, row, rowStart, rowEnd)}
                            onMouseMove={handleMoveTooltip}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            未排期 ({row.assigneeName || '未指派'})
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )
              })}

              {flatRows.length === 0 && (
                <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  当月暂无排期任务
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 富交互悬浮 Tooltip 卡片 */}
      {/* 每日工时压力悬停详情 Tooltip */}
      {pressureTooltip && (
        <div
          data-ui="gantt-tooltip"
          style={{
            left: `${pressureTooltip.x}px`,
            top: `${pressureTooltip.y}px`,
            width: '320px',
          }}
        >
          <div data-ui="gantt-tooltip-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={13} color="#4c9aff" />
              <span style={{ fontWeight: 700 }}>
                {pressureTooltip.data.dateStr} (周{['日', '一', '二', '三', '四', '五', '六'][pressureTooltip.data.dayOfWeek]})
              </span>
            </div>
            <span
              style={{
                fontSize: '10.5px',
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: 600,
                backgroundColor: pressureTooltip.data.levelColor,
                color: '#ffffff',
              }}
            >
              {pressureTooltip.data.levelLabel.split(' ')[0]}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#c1c7d0' }}>当日排期工时:</span>
              <strong style={{ fontSize: '13px', color: '#ffffff' }}>
                {pressureTooltip.data.hoursFormatted}
              </strong>
            </div>
            {pressureTooltip.data.dayInfo.isWorkday && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#c1c7d0' }}>标准工作日负荷率:</span>
                <span
                  style={{
                    fontWeight: 700,
                    color:
                      pressureTooltip.data.loadPercent > 120
                        ? '#ff5630'
                        : pressureTooltip.data.loadPercent > 100
                          ? '#ffab00'
                          : '#36b37e',
                  }}
                >
                  {pressureTooltip.data.loadPercent}%
                  <span style={{ fontSize: '10px', fontWeight: 400, color: '#97a0af', marginLeft: '3px' }}>
                    (以 8h/日 计)
                  </span>
                </span>
              </div>
            )}
            {pressureTooltip.data.dayInfo.holidayName && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#c1c7d0' }}>节假日/调休:</span>
                <span
                  style={{
                    color: pressureTooltip.data.dayInfo.isHoliday ? '#ff5630' : '#ffab00',
                    fontWeight: 600,
                  }}
                >
                  {pressureTooltip.data.dayInfo.holidayName}
                  {pressureTooltip.data.dayInfo.isHoliday ? ' (法定放假)' : ' (调休补班)'}
                </span>
              </div>
            )}
          </div>

          {/* 当日任务明细 */}
          <div>
            <div
              style={{
                fontSize: '11px',
                color: '#97a0af',
                marginBottom: '6px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Briefcase size={12} color="#a6c5e2" />
              <span>当日执行任务 ({pressureTooltip.data.tasks.length} 项):</span>
            </div>
            {pressureTooltip.data.tasks.length === 0 ? (
              <div style={{ color: '#97a0af', fontSize: '11.5px', fontStyle: 'italic', padding: '4px 0' }}>
                无排期任务
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  maxHeight: '160px',
                  overflowY: 'auto',
                }}
              >
                {pressureTooltip.data.tasks.map((t) => (
                  <div
                    key={t.key}
                    style={{
                      padding: '6px 8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '2px',
                      }}
                    >
                      <span style={{ fontWeight: 700, color: '#4c9aff' }}>{t.key}</span>
                      <span style={{ color: '#36b37e', fontWeight: 600 }}>当日: {t.dailyHoursFormatted}</span>
                    </div>
                    <div
                      style={{
                        color: '#ebecf0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={t.summary}
                    >
                      {t.summary}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: '#97a0af',
                        fontSize: '10px',
                        marginTop: '3px',
                      }}
                    >
                      <span>{t.assigneeName || '未指派'}</span>
                      <span>
                        总预估: {t.totalHoursFormatted} ({t.startDate.slice(5)} ~ {t.endDate.slice(5)})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tooltip && (
        <div
          data-ui="gantt-tooltip"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
          }}
        >
          <div data-ui="gantt-tooltip-header">
            <span style={{ fontWeight: 700, color: tooltip.row.isParent ? '#b8a8ff' : '#4c9aff' }}>
              {tooltip.row.key}
            </span>
            <span
              style={{
                fontSize: '10.5px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                padding: '1px 6px',
                borderRadius: '3px',
              }}
            >
              {tooltip.row.status}
            </span>
          </div>

          <div data-ui="gantt-tooltip-title">
            {tooltip.row.summary}
          </div>

          <div data-ui="gantt-tooltip-row">
            <User size={12} color="#a6c5e2.2" />
            <span>经办人: <strong>{tooltip.row.isMine ? `我 (${tooltip.row.assigneeName || '当前用户'})` : (tooltip.row.assigneeName || '未指派')}</strong></span>
          </div>

          <div data-ui="gantt-tooltip-row">
            <Calendar size={12} color="#a6c5e2" />
            <span>排期: <strong>{tooltip.startDate}</strong> ~ <strong>{tooltip.endDate}</strong></span>
          </div>

          <div data-ui="gantt-tooltip-row" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} color="#a6c5e2" />
              <span>预估: <strong>{formatHours(tooltip.row.originalEstimateSeconds)}</strong></span>
            </div>
            {tooltip.row.timeSpentSeconds > 0 && (
              <span>已耗时: <strong>{formatHours(tooltip.row.timeSpentSeconds)}</strong></span>
            )}
            <span>进度: <strong>{tooltip.row.progressPercent}%</strong></span>
          </div>

          {tooltip.row.progressPercent > 0 && (
            <div data-ui="gantt-tooltip-progress-bg">
              <div
                data-ui="gantt-tooltip-progress-fill"
                style={{ width: `${Math.min(tooltip.row.progressPercent, 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* 全局任务详情抽屉 */}
      <TaskDrawer
        issueKey={selectedIssueKey}
        onClose={() => setSelectedIssueKey(null)}
        onUpdated={loadData}
      />
    </div>
  )
}
