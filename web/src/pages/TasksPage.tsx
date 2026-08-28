import React, { useState, useEffect, useMemo } from 'react'
import {
  ListTodo,
  List,
  RotateCcw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Clock,
} from 'lucide-react'
import { api } from '../api/client'
import { IssueItem } from '../types'
import { TaskDrawer } from '../components/TaskDrawer'
import { WorklogDrawer } from '../components/WorklogDrawer'
import { TableSkeleton } from '../components/Skeleton'

/** 格式化本地日期 YYYY-MM-DD */
function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 获取给定日期所在周的周一 */
function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return date
}

/** 日期加减天数 */
function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return formatLocalDate(dt)
}

/** 判断任务是否属于已完成/已实现/已解决/已关闭等完工状态 */
function isTaskCompleted(item: IssueItem): boolean {
  if (item.statusCategory === 'Done') return true
  const s = (item.status || '').trim().toLowerCase()
  return (
    s === '已完成' ||
    s === '已实现' ||
    s === '已解决' ||
    s === '已关闭' ||
    s === '已发布' ||
    s === '已验收' ||
    s === 'done' ||
    s === 'closed' ||
    s === 'resolved' ||
    s === 'implemented'
  )
}

/** 格式化工时进度 (已报/预估，例如 32/40) */
function formatWorklogProgress(spentSec: number = 0, estSec: number = 0) {
  const spentH = spentSec > 0 ? (spentSec % 3600 === 0 ? spentSec / 3600 : Number((spentSec / 3600).toFixed(1))) : 0
  const estH = estSec > 0 ? (estSec % 3600 === 0 ? estSec / 3600 : Number((estSec / 3600).toFixed(1))) : 0

  if (spentSec <= 0 && estSec <= 0) {
    return { text: '-', isOver: false, isComplete: false, tooltip: '未登记且无预估工时' }
  }

  const text = estSec > 0 ? `${spentH}/${estH}` : `${spentH}/-`
  const isOver = estSec > 0 && spentSec > estSec
  const isComplete = estSec > 0 && spentSec >= estSec
  const tooltip = `已记录 ${spentH}h / 预估 ${estH > 0 ? `${estH}h` : '未设置'}`

  return { text, isOver, isComplete, tooltip, spentH, estH }
}

export const TasksPage: React.FC = () => {
  const [issues, setIssues] = useState<IssueItem[]>([])
  const [loading, setLoading] = useState(false)
  
  // 视图模式：'todo' (本周任务-全部状态) | 'all' (本月全部任务-全部状态)
  const [activeTab, setActiveTab] = useState<'todo' | 'all'>('todo')
  
  const [statusFilter, setStatusFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('currentUser()')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // 快捷记工时抽屉状态
  const [worklogDrawerOpen, setWorklogDrawerOpen] = useState(false)
  const [worklogIssueKey, setWorklogIssueKey] = useState<string | null>(null)

  // 当前选中的月份 YYYY-MM（用于“全部”任务按月查询，默认当月）
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // 计算本周范围（周一到周日）与今天
  const now = new Date()
  const todayStr = useMemo(() => formatLocalDate(new Date()), [])
  const weekStart = useMemo(() => formatLocalDate(getMonday(now)), [])
  const weekEnd = useMemo(() => addDaysStr(weekStart, 6), [weekStart])
  const weekRangeLabel = useMemo(() => {
    return `${weekStart.slice(5).replace('-', '/')} ~ ${weekEnd.slice(5).replace('-', '/')}`
  }, [weekStart, weekEnd])

  // 计算任务的到期状态 Tag（已完成/已实现的不提示逾期）
  const getDueTag = (item: IssueItem, isDone: boolean) => {
    if (isDone || isTaskCompleted(item)) return null
    const cleanEnd = item.endDate ? item.endDate.split('T')[0] : ''
    if (!cleanEnd) return null

    if (cleanEnd >= weekStart && cleanEnd <= weekEnd) {
      if (cleanEnd < todayStr) {
        return { label: '本周逾期', status: 'danger', title: `应于 ${cleanEnd} 结束，已逾期` }
      }
      if (cleanEnd === todayStr) {
        return { label: '今日到期', status: 'warning', title: `应于今日 (${cleanEnd}) 结束` }
      }
      return { label: '本周到期', status: 'warning', title: `预计结束日期: ${cleanEnd}` }
    }

    if (cleanEnd < weekStart) {
      return { label: '已逾期', status: 'danger', title: `应于 ${cleanEnd} 结束，已逾期` }
    }

    return null
  }

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

  const handleResetCurrentMonth = () => {
    const now = new Date()
    setCurrentMonth(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    )
  }

  const isCurrentMonth = useMemo(() => {
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return currentMonth === thisMonth
  }, [currentMonth])

  const loadIssues = () => {
    setLoading(true)
    api.getIssues({
      month: currentMonth || undefined,
      status: statusFilter || undefined,
      assignee: assigneeFilter || undefined,
    })
      .then((data) => {
        setIssues(data || [])
      })
      .catch((err) => {
        console.error('加载任务失败:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadIssues()
  }, [currentMonth, statusFilter, assigneeFilter])

  // 1. 本周任务（展示全部状态，包含待办、进行中、已完成/已实现）：排期与本周有交集，或未设置日期的任务
  const weekIssues = useMemo(() => {
    return issues.filter((item) => {
      const cleanStart = item.startDate ? item.startDate.split('T')[0] : ''
      const cleanEnd = item.endDate ? item.endDate.split('T')[0] : ''

      if (cleanStart && cleanEnd) {
        // 排期与本周有交集
        return cleanStart <= weekEnd && cleanEnd >= weekStart
      } else if (cleanStart) {
        return cleanStart <= weekEnd
      } else if (cleanEnd) {
        return cleanEnd >= weekStart
      }

      // 未设置起止日期的任务，默认包含
      return true
    })
  }, [issues, weekStart, weekEnd])

  // 2. 根据当前选中的 Tab 决定基准数据源
  const baseIssues = activeTab === 'todo' ? weekIssues : issues

  // 3. 本地搜索过滤 (Key / 标题 / 父需求 / 经办人)
  const displayIssues = useMemo(() => {
    if (!searchQuery.trim()) return baseIssues
    const q = searchQuery.toLowerCase().trim()
    return baseIssues.filter(
      (item) =>
        item.key.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        (item.parentKey && item.parentKey.toLowerCase().includes(q)) ||
        (item.parentSummary && item.parentSummary.toLowerCase().includes(q)) ||
        (item.assignee?.displayName && item.assignee.displayName.toLowerCase().includes(q))
    )
  }, [baseIssues, searchQuery])

  // 统计工时
  const totalEstimateSeconds = useMemo(() => {
    return displayIssues.reduce((acc, cur) => acc + (cur.originalEstimateSeconds || 0), 0)
  }, [displayIssues])
  const totalHoursStr = (totalEstimateSeconds / 3600).toFixed(1)

  return (
    <div data-ui="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 顶部过滤工具栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* 待办 / 全部 切换按钮组 */}
          <div data-ui="button-group">
            <button
              data-ui="button"
              data-variant={activeTab === 'todo' ? 'primary' : 'ghost'}
              onClick={() => setActiveTab('todo')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ListTodo size={15} />
              <span>待办</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: activeTab === 'todo' ? 'rgba(255,255,255,0.25)' : 'rgba(9,30,66,0.08)',
                  color: activeTab === 'todo' ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                {weekIssues.length}
              </span>
            </button>
            <button
              data-ui="button"
              data-variant={activeTab === 'all' ? 'primary' : 'ghost'}
              onClick={() => setActiveTab('all')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <List size={15} />
              <span>全部</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: activeTab === 'all' ? 'rgba(255,255,255,0.25)' : 'rgba(9,30,66,0.08)',
                  color: activeTab === 'all' ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                {issues.length}
              </span>
            </button>
          </div>

          {/* 待办模式下展示本周时间徽章 */}
          {activeTab === 'todo' && (
            <div
              style={{
                fontSize: '12.5px',
                fontWeight: 600,
                padding: '4px 10px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--color-primary)',
              }}
              title="展示本周（周一至周日）排期的任务（已完成任务置灰）"
            >
              <Calendar size={13} />
              <span>本周任务 ({weekRangeLabel})</span>
            </div>
          )}

          {/* 全部模式下展示月份选择器（与规划与排期保持一致） */}
          {activeTab === 'all' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button data-ui="button" data-size="sm" onClick={handlePrevMonth} title="上一月">
                <ChevronLeft size={14} />
              </button>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '4px 10px',
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
              <button data-ui="button" data-size="sm" onClick={handleNextMonth} title="下一月">
                <ChevronRight size={14} />
              </button>
              {!isCurrentMonth && (
                <button
                  data-ui="button"
                  data-size="sm"
                  data-variant="secondary"
                  onClick={handleResetCurrentMonth}
                  style={{ fontSize: '11.5px', padding: '3px 8px' }}
                  title="返回当月"
                >
                  本月
                </button>
              )}
            </div>
          )}

          {/* 任务搜索框 */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
            <input
              data-ui="input"
              placeholder="搜索 Key / 标题..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '30px', width: '170px', fontSize: '12.5px' }}
            />
          </div>

          {/* 成员过滤 */}
          <select
            data-ui="select"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            style={{ width: '130px', fontSize: '12.5px' }}
          >
            <option value="currentUser()">仅我的任务</option>
            <option value="">所有成员</option>
          </select>

          {/* 状态过滤 */}
          <select
            data-ui="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '130px', fontSize: '12.5px' }}
          >
            <option value="">全部状态</option>
            <option value="待办">待办 (To Do)</option>
            <option value="进行中">进行中 (In Progress)</option>
            <option value="已完成">已完成 (Done)</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* 预估工时统计徽章 */}
          <div
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
            <Clock size={13} color="var(--color-primary)" />
            <span>
              共 <strong>{displayIssues.length}</strong> 项 · 预估 <strong>{totalHoursStr}h</strong>
            </span>
          </div>

          <button data-ui="button" onClick={loadIssues}>
            <RotateCcw size={14} />
            <span>刷新</span>
          </button>
        </div>
      </div>

      {loading && <TableSkeleton rows={7} />}

      {/* 任务表格列表视图 */}
      {!loading && (
        <div data-ui="table-container">
          <table data-ui="table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Key</th>
                <th>概要</th>
                <th style={{ width: '110px' }}>类型</th>
                <th style={{ width: '100px' }}>状态</th>
                <th style={{ width: '110px' }}>经办人</th>
                <th style={{ width: '115px' }}>预计开始</th>
                <th style={{ width: '115px' }}>预计结束</th>
                <th style={{ width: '95px' }} title="已报工时 / 预估工时 (例如: 32/40)">预估工时</th>
                <th style={{ width: '90px', textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {displayIssues.map((item) => {
                const isDone = isTaskCompleted(item)
                const dueTag = getDueTag(item, isDone)

                return (
                  <tr
                    key={item.key}
                    style={{
                      cursor: 'pointer',
                      opacity: isDone ? 0.65 : 1,
                      backgroundColor: isDone ? 'rgba(9, 30, 66, 0.02)' : undefined,
                      color: isDone ? 'var(--text-muted)' : undefined,
                    }}
                    onClick={() => setSelectedKey(item.key)}
                  >
                    <td style={{ fontWeight: 700, color: isDone ? 'var(--text-muted)' : 'var(--color-primary)' }}>
                      {item.key}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontWeight: 500,
                              textDecoration: isDone ? 'line-through' : 'none',
                              color: isDone ? 'var(--text-muted)' : 'inherit',
                            }}
                          >
                            {item.summary}
                          </span>
                          {dueTag && (
                            <span
                              data-ui="tag"
                              data-status={dueTag.status}
                              style={{ fontSize: '11px', padding: '1px 6px', lineHeight: '1.2' }}
                              title={dueTag.title}
                            >
                              {dueTag.label}
                            </span>
                          )}
                        </div>
                        {item.parentKey && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            ↳ {item.parentKey} {item.parentSummary}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {isDone ? (
                        <span data-ui="tag" style={{ opacity: 0.8, color: 'var(--text-muted)' }}>
                          {item.issueType}
                        </span>
                      ) : (
                        <span data-ui="tag" data-status={item.issueType.toLowerCase() === 'bug' ? 'danger' : 'info'}>
                          {item.issueType}
                        </span>
                      )}
                    </td>
                    <td>
                      {isDone ? (
                        <span
                          data-ui="tag"
                          style={{
                            color: 'var(--text-muted)',
                            backgroundColor: 'rgba(9, 30, 66, 0.06)',
                            borderColor: 'rgba(9, 30, 66, 0.1)',
                          }}
                        >
                          {item.status}
                        </span>
                      ) : (
                        <span
                          data-ui="tag"
                          data-status={
                            item.statusCategory === 'In Progress' || item.status === '进行中'
                              ? 'in-progress'
                              : 'todo'
                          }
                        >
                          {item.status}
                        </span>
                      )}
                    </td>
                    <td style={{ color: isDone ? 'var(--text-muted)' : 'inherit' }}>{item.assignee?.displayName || '-'}</td>
                    <td style={{ color: isDone ? 'var(--text-muted)' : 'var(--color-success)', fontWeight: 500 }}>
                      {item.startDate || '-'}
                    </td>
                    <td
                      style={{
                        color: isDone
                          ? 'var(--text-muted)'
                          : dueTag
                          ? dueTag.status === 'danger'
                            ? 'var(--color-danger)'
                            : '#b76e00'
                          : 'var(--color-warning)',
                        fontWeight: !isDone && dueTag ? 600 : 500,
                      }}
                    >
                      {item.endDate || '-'}
                    </td>
                    <td
                      style={{ color: isDone ? 'var(--text-muted)' : 'inherit' }}
                      title={formatWorklogProgress(item.timeSpentSeconds, item.originalEstimateSeconds).tooltip}
                    >
                      {(() => {
                        const progress = formatWorklogProgress(item.timeSpentSeconds, item.originalEstimateSeconds)
                        if (progress.text === '-') {
                          return <span style={{ color: 'var(--text-muted)' }}>-</span>
                        }
                        return (
                          <span
                            style={{
                              fontWeight: 600,
                              fontVariantNumeric: 'tabular-nums',
                              color: isDone
                                ? 'var(--text-muted)'
                                : progress.isOver
                                ? 'var(--color-danger)'
                                : progress.isComplete
                                ? '#006644'
                                : 'inherit',
                            }}
                          >
                            {progress.text}
                          </span>
                        )
                      })()}
                    </td>
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        data-ui="button"
                        data-size="sm"
                        data-variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation()
                          setWorklogIssueKey(item.key)
                          setWorklogDrawerOpen(true)
                        }}
                        style={{
                          padding: '3px 8px',
                          fontSize: '11.5px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--color-primary)',
                        }}
                        title={`快捷登记 ${item.key} 工时`}
                      >
                        <Clock size={12} />
                        <span>记工时</span>
                      </button>
                    </td>
                  </tr>
                )
              })}

              {displayIssues.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    {activeTab === 'todo'
                      ? '本周暂无任务 🎉'
                      : `暂无 ${currentMonth} 符合条件的任务`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 详情抽屉 */}
      <TaskDrawer
        issueKey={selectedKey}
        onClose={() => setSelectedKey(null)}
        onUpdated={loadIssues}
      />

      {/* 快捷记工时抽屉 */}
      <WorklogDrawer
        isOpen={worklogDrawerOpen}
        onClose={() => {
          setWorklogDrawerOpen(false)
          setWorklogIssueKey(null)
        }}
        presetDate={todayStr}
        presetIssueKey={worklogIssueKey || undefined}
        loggedIssues={issues.map((i) => ({ key: i.key, summary: i.summary, status: i.status }))}
        onSaved={loadIssues}
      />
    </div>
  )
}
