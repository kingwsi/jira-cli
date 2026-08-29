import React, { useState, useEffect } from 'react'
import { Bug, RotateCcw, Search, User, ExternalLink, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { api } from '../api/client'
import { IssueItem } from '../types'
import { TaskDrawer } from '../components/TaskDrawer'
import { QuickResolveModal } from '../components/QuickResolveModal'
import { TableSkeleton } from '../components/Skeleton'

export interface BugsPageProps {
  embedded?: boolean
  onUnresolvedCountChange?: (count: number) => void
}

export const BugsPage: React.FC<BugsPageProps> = ({ embedded = false, onUnresolvedCountChange }) => {
  const [bugs, setBugs] = useState<IssueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('待处理')
  const [assigneeFilter, setAssigneeFilter] = useState('currentUser()')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [resolvingIssue, setResolvingIssue] = useState<IssueItem | null>(null)
  const [resolvingAnchorRect, setResolvingAnchorRect] = useState<DOMRect | null>(null)
  const [jiraUrl, setJiraUrl] = useState('')

  useEffect(() => {
    api.getConfig()
      .then((cfg) => {
        if (cfg && cfg.url) {
          setJiraUrl(cfg.url.replace(/\/+$/, ''))
        }
      })
      .catch(() => {})
  }, [])

  const loadBugs = () => {
    setLoading(true)
    setError(null)
    api.getIssues({
      type: 'Bug',
      status: statusFilter || undefined,
      assignee: assigneeFilter || undefined,
    })
      .then((data) => {
        const list = data || []
        setBugs(list)
        if (onUnresolvedCountChange) {
          const unres = list.filter((b) => b.statusCategory !== 'Done').length
          onUnresolvedCountChange(unres)
        }
      })
      .catch((err: any) => {
        console.error('加载缺陷失败:', err)
        setError(err.message || '加载缺陷列表失败')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadBugs()
  }, [statusFilter, assigneeFilter])

  // 本地关键字过滤
  const filteredBugs = bugs.filter((item) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      item.key.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      (item.assignee?.displayName && item.assignee.displayName.toLowerCase().includes(q))
    )
  })

  // 统计指标
  const unresolvedCount = bugs.filter((b) => b.statusCategory !== 'Done').length
  const resolvedCount = bugs.filter((b) => b.statusCategory === 'Done').length

  const openJira = (key: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!jiraUrl) return
    window.open(`${jiraUrl}/browse/${key}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div data-ui={embedded ? undefined : 'page-content'} data-page="bugs" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
          <div data-ui="page-heading" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '16px' }}>
            <Bug size={20} color="var(--color-danger)" />
            <span>缺陷与问题中心</span>
          </div>

          {/* 统计胶囊 */}
          <div data-ui="toolbar-chips" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <span
              data-ui="toolbar-chip"
              style={{
                backgroundColor: 'var(--bg-danger-subtle)',
                color: 'var(--color-danger)',
                border: '1px solid var(--border-danger)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Clock size={12} />
              待解决: {unresolvedCount}
            </span>
            <span
              data-ui="toolbar-chip"
              style={{
                backgroundColor: 'var(--bg-success-subtle)',
                color: 'var(--color-success)',
                border: '1px solid var(--border-success)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <CheckCircle2 size={12} />
              已解决: {resolvedCount}
            </span>
          </div>

          {/* 人员筛选 */}
          <select
            data-ui="select"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            style={{ width: '135px' }}
          >
            <option value="currentUser()">👤 仅我的缺陷</option>
            <option value="all">👥 全部成员缺陷</option>
          </select>

          {/* 状态筛选 */}
          <select
            data-ui="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '155px' }}
          >
            <option value="待处理">待处理 (未解决)</option>
            <option value="">全部状态</option>
            <option value="待办">待办 / 新建 (To Do)</option>
            <option value="进行中">修复中 (In Progress)</option>
            <option value="已解决">已解决 / 已关闭 (Done)</option>
          </select>

          {/* 搜索框 */}
          <div data-ui="search-input" style={{ width: '220px' }}>
            <Search size={14} />
            <input
              data-ui="input"
              placeholder="搜索 Key 或缺陷概要..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ height: '32px', fontSize: '12px' }}
            />
          </div>
        </div>

        <div data-ui="toolbar-actions">
          <button data-ui="button" onClick={loadBugs} disabled={loading}>
            <RotateCcw size={14} className={loading ? 'vbg-spinner' : ''} />
            <span>刷新 ({filteredBugs.length})</span>
          </button>
        </div>
      </div>

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
          <button data-ui="button" data-variant="secondary" data-size="sm" onClick={loadBugs}>
            重试
          </button>
        </div>
      )}

      {/* 加载状态 */}
      {loading && <TableSkeleton rows={6} />}

      {/* 缺陷表格 */}
      {!loading && !error && (
        <div data-ui="table-container" data-mobile-table="bugs">
          <table data-ui="table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Key</th>
                <th>缺陷概要</th>
                <th style={{ width: '90px' }}>严重级别</th>
                <th style={{ width: '110px' }}>状态</th>
                <th style={{ width: '120px' }}>经办人</th>
                <th style={{ width: '110px' }}>报告人</th>
                <th style={{ width: '120px' }}>预计解决</th>
                <th style={{ width: '90px', textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredBugs.map((item) => (
                <tr
                  key={item.key}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedKey(item.key)}
                >
                  <td>
                    <span
                      onClick={(e) => openJira(item.key, e)}
                      title={`点击在 Jira 官方系统中打开 ${item.key}`}
                      style={{
                        fontWeight: 700,
                        color: 'var(--color-danger)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        textDecoration: 'underline',
                        textDecorationColor: 'transparent',
                        transition: 'text-decoration-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.textDecorationColor = 'var(--color-danger)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.textDecorationColor = 'transparent'
                      }}
                    >
                      <span>{item.key}</span>
                      <ExternalLink size={11} style={{ opacity: 0.6 }} />
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontWeight: 500 }}>{item.summary}</span>
                      {item.parentKey && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          ↳ 关联需求: {item.parentKey} {item.parentSummary}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      data-ui="tag"
                      data-status={
                        ['blocker', 'critical', 'high', '高', '严重', '紧急', '致命'].includes(
                          (item.priority || '').toLowerCase()
                        )
                          ? 'danger'
                          : 'warning'
                      }
                    >
                      {item.priority || 'Normal'}
                    </span>
                  </td>
                  <td>
                    <span
                      data-ui="tag"
                      data-status={
                        item.statusCategory === 'Done'
                          ? 'done'
                          : item.statusCategory === 'In Progress'
                          ? 'in-progress'
                          : 'todo'
                      }
                    >
                      {item.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <User size={13} color="var(--text-muted)" />
                      <span>{item.assignee?.displayName || '未指派'}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {item.reporter?.displayName || '-'}
                  </td>
                  <td style={{ color: 'var(--color-warning)', fontSize: '12px', fontWeight: 500 }}>
                    {item.endDate || '-'}
                  </td>
                  <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    {item.statusCategory !== 'Done' ? (
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
                        title="快捷流转并指派给创建人"
                        style={{
                          padding: '3px 8px',
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: 'var(--color-success)',
                          borderColor: 'var(--color-success)',
                          color: '#fff',
                        }}
                      >
                        <CheckCircle2 size={13} />
                        <span>已解决</span>
                      </button>
                    ) : (
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
                        title="变更流转状态或指派人员"
                        style={{
                          padding: '3px 8px',
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <CheckCircle2 size={13} color="var(--color-success)" />
                        <span>流转</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {filteredBugs.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
                    {searchQuery ? '没有找到匹配的缺陷' : '暂无符合条件的缺陷记录'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 快捷解决与流转轻量弹窗 */}
      <QuickResolveModal
        isOpen={Boolean(resolvingIssue)}
        issue={resolvingIssue}
        anchorRect={resolvingAnchorRect}
        onClose={() => {
          setResolvingIssue(null)
          setResolvingAnchorRect(null)
        }}
        onResolved={loadBugs}
      />

      {/* 详情抽屉 */}
      <TaskDrawer
        issueKey={selectedKey}
        onClose={() => setSelectedKey(null)}
        onUpdated={loadBugs}
      />
    </div>
  )
}
