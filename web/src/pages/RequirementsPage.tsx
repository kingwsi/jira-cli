import React, { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  RotateCcw,
  Search,
  ExternalLink,
  AlertTriangle,
  Sparkles,
  MessageSquare,
  CheckCircle2,
  Building2,
  Tag,
  User,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { api } from '../api/client'
import { IssueItem } from '../types'
import { TaskDrawer } from '../components/TaskDrawer'
import { WeeklyProgressModal } from '../components/WeeklyProgressModal'
import { QuickResolveModal } from '../components/QuickResolveModal'
import { TableSkeleton, TaskOrdersCardSkeleton } from '../components/Skeleton'

export interface RequirementsPageProps {
  embedded?: boolean
  onCountChange?: (count: number) => void
}

const DEFAULT_STATUS_LIST = [
  '规划中',
  '初审中',
  '研发评审中',
  '高级评审中',
  '商务审核中',
  '排期中',
  '设计中',
  '设计评审中',
  '开发中',
  '测试中',
  '验收中',
  '重新打开',
  '"To Do"',
  '"In Progress"',
  '待处理',
  '待确认',
  '实现中',
  '已验证',
  '已解决',
  '"接受/处理"',
  '新',
  '调研中',
  '立项中',
  '上线中',
  '合并代码中',
  '打包发布中',
  '等待开发',
]

function isDateInCurrentWeek(dateStr?: string): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false

  const now = new Date()
  const currentDay = now.getDay() === 0 ? 7 : now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - currentDay + 1)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  return d >= monday && d <= sunday
}

export const RequirementsPage: React.FC<RequirementsPageProps> = ({
  embedded = false,
  onCountChange,
}) => {
  const [issues, setIssues] = useState<IssueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 筛选项
  const [assigneeFilter, setAssigneeFilter] = useState<'currentUser()' | 'all'>('currentUser()')
  const [typeFilter, setTypeFilter] = useState<'all' | '一般需求' | '协助'>('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active')
  const [searchQuery, setSearchQuery] = useState('')

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [weeklyModalIssue, setWeeklyModalIssue] = useState<IssueItem | null>(null)
  const [resolvingIssue, setResolvingIssue] = useState<IssueItem | null>(null)
  const [resolvingAnchorRect, setResolvingAnchorRect] = useState<DOMRect | null>(null)
  const [jiraUrl, setJiraUrl] = useState('')

  useEffect(() => {
    api
      .getConfig()
      .then((cfg) => {
        if (cfg && cfg.url) {
          setJiraUrl(cfg.url.replace(/\/+$/, ''))
        }
      })
      .catch(() => { })
  }, [])

  const buildJql = () => {
    const conditions: string[] = []

    // 1. 类型过滤
    if (typeFilter === 'all') {
      conditions.push('issuetype in (一般需求, 协助)')
    } else {
      conditions.push(`issuetype = '${typeFilter}'`)
    }

    // 2. 状态过滤
    if (statusFilter === 'active') {
      conditions.push(`status in (${DEFAULT_STATUS_LIST.join(', ')})`)
    }

    // 3. 经办人过滤
    if (assigneeFilter === 'currentUser()') {
      conditions.push('assignee in (currentUser())')
    }

    return `${conditions.join(' AND ')} ORDER BY priority DESC, updated DESC`
  }

  const loadRequirements = () => {
    setLoading(true)
    setError(null)
    const jql = buildJql()

    api
      .getIssues({ jql })
      .then((data) => {
        const list = data || []
        setIssues(list)
        if (onCountChange) {
          onCountChange(list.length)
        }
      })
      .catch((err: any) => {
        console.error('加载需求看板数据失败:', err)
        setError(err.message || '加载需求列表失败')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadRequirements()
  }, [assigneeFilter, typeFilter, statusFilter])

  // 本地文本模糊搜索
  const filteredIssues = useMemo(() => {
    if (!searchQuery.trim()) return issues
    const q = searchQuery.toLowerCase().trim()
    return issues.filter((item) => {
      const matchKey = item.key.toLowerCase().includes(q)
      const matchSummary = item.summary.toLowerCase().includes(q)
      const matchAssignee = item.assignee?.displayName?.toLowerCase().includes(q)
      const matchReporter = item.reporter?.displayName?.toLowerCase().includes(q)
      const matchStatus = item.status.toLowerCase().includes(q)
      return matchKey || matchSummary || matchAssignee || matchReporter || matchStatus
    })
  }, [issues, searchQuery])

  // 任务令特殊专项需求（仅针对 YFJD 项目或任务令）
  const specialTaskOrders = useMemo(() => {
    return filteredIssues.filter(
      (item) =>
        item.projectKey === 'YFJD' ||
        item.issueType === '任务令' ||
        item.summary.includes('任务令')
    )
  }, [filteredIssues])

  const openJira = (key: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!jiraUrl) return
    window.open(`${jiraUrl}/browse/${key}`, '_blank', 'noopener,noreferrer')
  }

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'Highest':
      case 'High':
      case '最高':
      case '高':
        return { color: 'var(--color-danger)', fontWeight: 600 }
      case 'Medium':
      case '中':
        return { color: 'var(--color-warning)', fontWeight: 500 }
      default:
        return { color: 'var(--text-secondary)' }
    }
  }

  const getTypeBadgeStyle = (type: string, projectKey?: string) => {
    if (projectKey === 'YFJD') {
      return {
        backgroundColor: 'rgba(0, 135, 90, 0.08)',
        color: '#00875A',
        border: '1px solid rgba(0, 135, 90, 0.25)',
      }
    }
    if (type === '协助') {
      return {
        backgroundColor: 'rgba(101, 84, 192, 0.1)',
        color: '#6554C0',
        border: '1px solid rgba(101, 84, 192, 0.25)',
      }
    }
    return {
      backgroundColor: 'rgba(0, 82, 204, 0.1)',
      color: '#0052CC',
      border: '1px solid rgba(0, 82, 204, 0.25)',
    }
  }

  return (
    <div
      data-ui={embedded ? undefined : 'page-content'}
      data-page="requirements"
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
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
          <div
            data-ui="page-heading"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              fontSize: '16px',
              color: 'var(--text-primary)',
            }}
          >
            <FileText size={20} color="var(--color-primary)" />
            <span>需求与协作</span>
          </div>

          {/* 类型筛选 */}
          <select
            data-ui="select"
            data-mobile-visibility="secondary-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            style={{ width: '130px', fontSize: '12.5px' }}
          >
            <option value="all">全部类型 (需求+协助)</option>
            <option value="一般需求">仅一般需求</option>
            <option value="协助">仅协助</option>
          </select>

          {/* 人员筛选 */}
          <select
            data-ui="select"
            data-mobile-visibility="secondary-filter"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value as any)}
            style={{ width: '130px', fontSize: '12.5px' }}
          >
            <option value="currentUser()">仅我的需求</option>
            <option value="all">全部成员需求</option>
          </select>

          {/* 状态范围筛选 */}
          <select
            data-ui="select"
            data-mobile-visibility="secondary-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ width: '135px', fontSize: '12.5px' }}
          >
            <option value="active">活跃流转中</option>
            <option value="all">全部状态 (含归档)</option>
          </select>

          {/* 搜索框 */}
          <div
            data-ui="search-input"
            data-mobile-visibility="page-search"
            style={{ width: '220px' }}
          >
            <Search size={14} />
            <input
              data-ui="input"
              placeholder="搜索 Key、标题或经办人..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ height: '32px', fontSize: '12px' }}
            />
          </div>
        </div>

        <div data-ui="toolbar-actions">
          <button data-ui="button" onClick={loadRequirements} disabled={loading}>
            <RotateCcw size={14} className={loading ? 'vbg-spinner' : ''} />
            <span>刷新 ({filteredIssues.length})</span>
          </button>
        </div>
      </div>

      {/* 加载中的专项任务令卡片骨架屏 */}
      {loading && <TaskOrdersCardSkeleton count={2} />}

      {/* 专项任务令专属置顶卡片区 */}
      {specialTaskOrders.length > 0 && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={15} color="#00875A" />
              <span>季度任务令 / 重点专项进度追踪 ({specialTaskOrders.length})</span>
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 400 }}>
              每周五定期更新总进度与周报备注
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                specialTaskOrders.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(380px, 1fr))',
              gap: '12px',
            }}
          >
            {specialTaskOrders.map((item) => {
              const pr = item.progressReport
              const curProgress = pr?.currentProgress ?? 0
              const lastProgress = pr?.lastWeekProgress ?? curProgress
              const diff = curProgress - lastProgress

              return (
                <div
                  key={item.key}
                  data-ui="card"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  {/* 头部：Key + 标题 + 状态 处于同一行，右侧为详情入口 */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        {/* Key：无背景无边框，仅保留跳转与 icon */}
                        <span
                          onClick={(e) => openJira(item.key, e)}
                          title="在 Jira 中打开"
                          style={{
                            fontWeight: 700,
                            fontSize: '12.5px',
                            fontFamily: 'var(--font-mono)',
                            color: '#0052CC',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            flexShrink: 0,
                          }}
                        >
                          {item.key}
                          <ExternalLink size={11} />
                        </span>

                        {/* 标题 */}
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          onClick={() => setWeeklyModalIssue(item)}
                          title={item.summary}
                        >
                          {item.summary}
                        </span>

                        {/* 状态 Tag */}
                        <span
                          data-ui="tag"
                          style={{
                            fontSize: '11px',
                            padding: '1px 6px',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {item.status}
                        </span>
                      </div>

                      {/* 右上角：详情 icon 按钮 (打开进度与周报弹窗) */}
                      <button
                        data-ui="button"
                        data-variant="ghost"
                        onClick={() => setWeeklyModalIssue(item)}
                        title="查看/更新任务令进度周报"
                        style={{
                          padding: '3px',
                          height: '24px',
                          width: '24px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <ArrowUpRight size={14} />
                      </button>
                    </div>

                    {/* 辅助属性 */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginTop: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {pr?.clientName && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Building2 size={12} style={{ color: 'var(--text-muted)' }} />
                          {pr.clientName}
                        </span>
                      )}
                      {pr?.category && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Tag size={12} style={{ color: 'var(--text-muted)' }} />
                          {pr.category}
                        </span>
                      )}
                      {pr?.productManager && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <User size={12} style={{ color: 'var(--text-muted)' }} />
                          PM: {pr.productManager.displayName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 方案2：双层叠影对比进度展示 */}
                  <div
                    style={{
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-subtle)',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          推进进度
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        {diff !== 0 ? (
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 600,
                              fontFamily: 'var(--font-mono)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              color: diff > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                              backgroundColor: diff > 0 ? 'rgba(0, 135, 90, 0.08)' : 'rgba(222, 53, 11, 0.08)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {diff > 0 ? (
                              <>
                                <TrendingUp size={12} />
                                +{diff}%
                              </>
                            ) : (
                              <>
                                <TrendingDown size={12} />
                                {diff}%
                              </>
                            )}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            较上周持平
                          </span>
                        )}

                        {/* 强调的大数字 */}
                        <div style={{ display: 'flex', alignItems: 'baseline' }}>
                          <span
                            style={{
                              fontSize: '22px',
                              fontWeight: 800,
                              lineHeight: 1,
                              fontFamily: 'var(--font-mono)',
                              color:
                                curProgress >= 100
                                  ? 'var(--color-success)'
                                  : 'var(--color-primary)',
                            }}
                          >
                            {curProgress}
                          </span>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              marginLeft: '1px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            %
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 矩形块状进度条 (20段) */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(20, 1fr)',
                        gap: '2.5px',
                        height: '10px',
                      }}
                    >
                      {Array.from({ length: 20 }).map((_, idx) => {
                        const blockPercent = (idx + 1) * 5
                        const isCurFilled = curProgress >= blockPercent
                        const isLastFilled = lastProgress >= blockPercent

                        let bg = 'var(--bg-muted)'
                        let border = 'var(--border-default)'

                        if (diff >= 0) {
                          if (isLastFilled) {
                            bg = curProgress >= 100 ? '#00875A' : '#0052CC'
                            border = curProgress >= 100 ? '#00875A' : '#0052CC'
                          } else if (isCurFilled) {
                            bg = curProgress >= 100 ? '#36B37E' : '#4C9AFF'
                            border = curProgress >= 100 ? '#36B37E' : '#2684FF'
                          }
                        } else {
                          if (isCurFilled) {
                            bg = '#DE350B'
                            border = '#DE350B'
                          } else if (isLastFilled) {
                            bg = 'rgba(222, 53, 11, 0.22)'
                            border = 'rgba(222, 53, 11, 0.4)'
                          }
                        }

                        return (
                          <div
                            key={idx}
                            style={{
                              height: '100%',
                              backgroundColor: bg,
                              border: `1px solid ${border}`,
                              borderRadius: '2px',
                              transition: 'all 0.2s ease',
                            }}
                            title={`${blockPercent}%`}
                          />
                        )
                      })}
                    </div>

                    {/* 微型刻度与对比提示 */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '10.5px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: curProgress >= 100 ? '#00875A' : '#0052CC',
                            display: 'inline-block',
                          }}
                        />
                        <span>上周基准: {lastProgress}%</span>
                      </div>

                      {diff !== 0 && (
                        <span
                          style={{
                            color: diff > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                            fontWeight: 600,
                          }}
                        >
                          {diff > 0 ? `▲ 本周推进 +${diff}%` : `▼ 回退 ${diff}%`}
                        </span>
                      )}

                      <span>目标: 100%</span>
                    </div>
                  </div>

                  {/* 本周备注标识 */}
                  {(() => {
                    const isUpdatedThisWeek = isDateInCurrentWeek(pr?.latestCommentTime)

                    if (isUpdatedThisWeek && pr?.latestComment) {
                      return (
                        <div
                          style={{
                            fontSize: '12px',
                            backgroundColor: 'rgba(0, 135, 90, 0.04)',
                            border: '1px solid rgba(0, 135, 90, 0.2)',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#00875A',
                              backgroundColor: 'rgba(0, 135, 90, 0.12)',
                              padding: '1.5px 6px',
                              borderRadius: 'var(--radius-xs)',
                              flexShrink: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <MessageSquare size={11} />
                            本周已更新
                          </span>
                          <div
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              lineHeight: 1.4,
                              color: 'var(--text-primary)',
                              flex: 1,
                            }}
                            title={pr.latestComment}
                          >
                            {pr.latestComment}
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div
                        style={{
                          fontSize: '11.5px',
                          color: 'var(--text-muted)',
                          backgroundColor: 'var(--bg-app)',
                          border: '1px dashed var(--border-default)',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          overflow: 'hidden',
                        }}
                      >
                        <MessageSquare size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                        <span style={{ flexShrink: 0, color: 'var(--text-secondary)' }}>本周待更新</span>
                        {pr?.latestComment && (
                          <span
                            style={{
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontSize: '11px',
                            }}
                            title={`往期备注: ${pr.latestComment}`}
                          >
                            (往期: {pr.latestComment})
                          </span>
                        )}
                      </div>
                    )
                  })()}

                  {/* 操作按钮 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      marginTop: '2px',
                    }}
                  >
                    <button
                      data-ui="button"
                      data-size="sm"
                      data-variant="primary"
                      onClick={() => setWeeklyModalIssue(item)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '12px',
                        fontWeight: 500,
                        backgroundColor: '#00875A',
                        borderColor: '#00875A',
                        color: '#fff',
                      }}
                    >
                      <span>查看与更新</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div
          data-ui="card"
          style={{
            backgroundColor: 'var(--bg-danger-subtle)',
            borderColor: 'var(--border-danger)',
            color: 'var(--color-danger)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button
            data-ui="button"
            data-variant="secondary"
            data-size="sm"
            onClick={loadRequirements}
          >
            重试
          </button>
        </div>
      )}

      {/* 加载状态 */}
      {loading && <TableSkeleton rows={6} />}

      {/* 需求列表表格 */}
      {!loading && !error && (
        <div data-ui="table-container" data-mobile-table="requirements">
          <table data-ui="table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Key</th>
                <th style={{ width: '80px' }}>类型</th>
                <th>概要</th>
                <th style={{ width: '100px' }}>状态</th>
                <th style={{ width: '80px' }}>优先级</th>
                <th style={{ width: '110px' }}>经办人</th>
                <th style={{ width: '110px' }}>报告人</th>
                <th style={{ width: '130px' }}>更新时间</th>
                <th style={{ width: '110px', textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.map((item) => {
                const isTaskOrder =
                  item.projectKey === 'YFJD' ||
                  item.issueType === '任务令' ||
                  item.summary.includes('任务令')

                return (
                  <tr
                    key={item.key}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedKey(item.key)}
                  >
                    <td>
                      <span
                        onClick={(e) => openJira(item.key, e)}
                        title={`在 Jira 中打开 ${item.key}`}
                        style={{
                          fontWeight: 700,
                          color: isTaskOrder ? '#00875A' : 'var(--color-primary)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          textDecoration: 'underline',
                          textDecorationColor: 'transparent',
                          transition: 'text-decoration-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecorationColor = isTaskOrder
                            ? '#00875A'
                            : 'var(--color-primary)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecorationColor = 'transparent'
                        }}
                      >
                        {item.key}
                        <ExternalLink size={11} style={{ opacity: 0.6 }} />
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11.5px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 500,
                          ...getTypeBadgeStyle(item.issueType, item.projectKey),
                        }}
                      >
                        {isTaskOrder ? '任务令' : item.issueType}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {item.summary}
                      </div>
                    </td>
                    <td>
                      <span
                        data-ui="tag"
                        style={{
                          fontSize: '11.5px',
                          whiteSpace: 'nowrap',
                          fontWeight: 500,
                        }}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <span style={getPriorityStyle(item.priority)}>
                        {item.priority || '-'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                        {item.assignee?.displayName || '-'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                        {item.reporter?.displayName || '-'}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.updatedAt ? item.updatedAt.slice(0, 16).replace('T', ' ') : '-'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        {item.issueType === '协助' && item.status !== '验收中' && item.statusCategory !== 'Done' && (
                          <button
                            data-ui="button"
                            data-variant="primary"
                            data-size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              const rect = e.currentTarget.getBoundingClientRect()
                              setResolvingAnchorRect(rect)
                              setResolvingIssue(item)
                            }}
                            title="点击直接流转到验收中（可指派给提单人/报告人）"
                            style={{
                              padding: '2px 8px',
                              fontSize: '11.5px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: 'var(--color-success)',
                              borderColor: 'var(--color-success)',
                              color: '#fff',
                            }}
                          >
                            <CheckCircle2 size={12} />
                            <span>完成</span>
                          </button>
                        )}
                        {item.issueType === '协助' && item.status === '验收中' && (
                          <button
                            data-ui="button"
                            data-variant="secondary"
                            data-size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              const rect = e.currentTarget.getBoundingClientRect()
                              setResolvingAnchorRect(rect)
                              setResolvingIssue(item)
                            }}
                            title="流转状态"
                            style={{
                              padding: '2px 6px',
                              fontSize: '11.5px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <CheckCircle2 size={11} color="var(--color-success)" />
                            <span>流转</span>
                          </button>
                        )}
                        {isTaskOrder && (
                          <button
                            data-ui="button"
                            data-size="sm"
                            data-variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation()
                              setWeeklyModalIssue(item)
                            }}
                            title="更新本周进度与周报备注"
                            style={{
                              fontSize: '11.5px',
                              padding: '2px 6px',
                              color: '#00875A',
                              borderColor: 'rgba(0, 135, 90, 0.4)',
                            }}
                          >
                            周报
                          </button>
                        )}
                        <button
                          data-ui="button"
                          data-size="sm"
                          data-variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedKey(item.key)
                          }}
                          style={{ fontSize: '12px', padding: '2px 8px' }}
                        >
                          详情
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filteredIssues.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      textAlign: 'center',
                      padding: '40px 0',
                      color: 'var(--text-muted)',
                    }}
                  >
                    没有匹配的需求或协助任务
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 快捷完成与流转轻量弹窗 */}
      <QuickResolveModal
        isOpen={Boolean(resolvingIssue)}
        issue={resolvingIssue}
        anchorRect={resolvingAnchorRect}
        onClose={() => {
          setResolvingIssue(null)
          setResolvingAnchorRect(null)
        }}
        onResolved={loadRequirements}
      />

      {/* 需求详情抽屉 (通用需求) */}
      {selectedKey && (
        <TaskDrawer
          issueKey={selectedKey}
          onClose={() => setSelectedKey(null)}
          onUpdated={loadRequirements}
        />
      )}

      {/* 任务令专属周报与多阶段进度弹窗 */}
      <WeeklyProgressModal
        issue={weeklyModalIssue}
        onClose={() => setWeeklyModalIssue(null)}
        onSuccess={() => {
          loadRequirements()
        }}
        jiraUrl={jiraUrl}
      />
    </div>
  )
}

export default RequirementsPage
