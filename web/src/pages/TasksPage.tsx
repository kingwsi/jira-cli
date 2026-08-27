import React, { useState, useEffect } from 'react'
import { List, LayoutGrid, RotateCcw, Calendar } from 'lucide-react'
import { api } from '../api/client'
import { IssueItem } from '../types'
import { TaskDrawer } from '../components/TaskDrawer'

export const TasksPage: React.FC = () => {
  const [issues, setIssues] = useState<IssueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [viewType, setViewType] = useState<'table' | 'kanban'>('table')
  const [statusFilter, setStatusFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('currentUser()')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const loadIssues = () => {
    setLoading(true)
    api.getIssues({
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
  }, [statusFilter, assigneeFilter])

  // 看板分栏
  const todoIssues = issues.filter(
    (i) => i.statusCategory === 'To Do' || i.status === '待办' || i.status === 'Open'
  )
  const inProgressIssues = issues.filter(
    (i) => i.statusCategory === 'In Progress' || i.status === '进行中' || i.status === 'In Progress'
  )
  const doneIssues = issues.filter(
    (i) => i.statusCategory === 'Done' || i.status === '已完成' || i.status === 'Closed' || i.status === 'Resolved'
  )

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div data-ui="button-group">
            <button
              data-ui="button"
              data-variant={viewType === 'table' ? 'primary' : 'ghost'}
              onClick={() => setViewType('table')}
            >
              <List size={15} />
              <span>表格列表</span>
            </button>
            <button
              data-ui="button"
              data-variant={viewType === 'kanban' ? 'primary' : 'ghost'}
              onClick={() => setViewType('kanban')}
            >
              <LayoutGrid size={15} />
              <span>状态看板</span>
            </button>
          </div>

          {/* 筛选选项 */}
          <select
            data-ui="select"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            style={{ width: '140px' }}
          >
            <option value="currentUser()">仅我的任务</option>
            <option value="">所有成员</option>
          </select>

          <select
            data-ui="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '130px' }}
          >
            <option value="">全部状态</option>
            <option value="待办">待办 (To Do)</option>
            <option value="进行中">进行中 (In Progress)</option>
            <option value="已完成">已完成 (Done)</option>
          </select>
        </div>

        <button data-ui="button" onClick={loadIssues}>
          <RotateCcw size={14} />
          <span>刷新 ({issues.length})</span>
        </button>
      </div>

      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          加载任务列表中...
        </div>
      )}

      {/* 1. 表格视图 */}
      {!loading && viewType === 'table' && (
        <div data-ui="table-container">
          <table data-ui="table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Key</th>
                <th>概要</th>
                <th style={{ width: '110px' }}>类型</th>
                <th style={{ width: '100px' }}>状态</th>
                <th style={{ width: '110px' }}>经办人</th>
                <th style={{ width: '120px' }}>预计开始</th>
                <th style={{ width: '120px' }}>预计结束</th>
                <th style={{ width: '90px' }}>预估工时</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((item) => (
                <tr
                  key={item.key}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedKey(item.key)}
                >
                  <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{item.key}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 500 }}>{item.summary}</span>
                      {item.parentKey && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          ↳ {item.parentKey} {item.parentSummary}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span data-ui="tag" data-status={item.issueType.toLowerCase() === 'bug' ? 'danger' : 'info'}>
                      {item.issueType}
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
                  <td>{item.assignee?.displayName || '-'}</td>
                  <td style={{ color: 'var(--color-success)', fontWeight: 500 }}>{item.startDate || '-'}</td>
                  <td style={{ color: 'var(--color-warning)', fontWeight: 500 }}>{item.endDate || '-'}</td>
                  <td>
                    {item.originalEstimateSeconds > 0
                      ? `${(item.originalEstimateSeconds / 3600).toFixed(1)}h`
                      : '-'}
                  </td>
                </tr>
              ))}

              {issues.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    暂无符合条件的任务
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. 看板视图 */}
      {!loading && viewType === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'start' }}>
          {/* 待办 */}
          <div data-ui="card" style={{ padding: '12px', backgroundColor: '#fafbfc' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '12px', color: 'var(--text-secondary)' }}>
              待办 (To Do) · {todoIssues.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {todoIssues.map((item) => (
                <div
                  key={item.key}
                  data-ui="card"
                  style={{ padding: '12px', cursor: 'pointer' }}
                  onClick={() => setSelectedKey(item.key)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '12px' }}>
                      {item.key}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {item.assignee?.displayName}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>{item.summary}</div>
                  {item.startDate && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} />
                      <span>{item.startDate} ~ {item.endDate}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 进行中 */}
          <div data-ui="card" style={{ padding: '12px', backgroundColor: '#fafbfc' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '12px', color: 'var(--color-primary)' }}>
              进行中 (In Progress) · {inProgressIssues.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {inProgressIssues.map((item) => (
                <div
                  key={item.key}
                  data-ui="card"
                  style={{ padding: '12px', cursor: 'pointer', borderLeft: '3px solid var(--color-primary)' }}
                  onClick={() => setSelectedKey(item.key)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '12px' }}>
                      {item.key}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {item.assignee?.displayName}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>{item.summary}</div>
                  {item.startDate && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} />
                      <span>{item.startDate} ~ {item.endDate}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 已完成 */}
          <div data-ui="card" style={{ padding: '12px', backgroundColor: '#fafbfc' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '12px', color: 'var(--color-success)' }}>
              已完成 (Done) · {doneIssues.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {doneIssues.map((item) => (
                <div
                  key={item.key}
                  data-ui="card"
                  style={{ padding: '12px', cursor: 'pointer', opacity: 0.8 }}
                  onClick={() => setSelectedKey(item.key)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '12px' }}>
                      {item.key}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {item.assignee?.displayName}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 500, textDecoration: 'line-through' }}>
                    {item.summary}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 详情抽屉 */}
      <TaskDrawer
        issueKey={selectedKey}
        onClose={() => setSelectedKey(null)}
        onUpdated={loadIssues}
      />
    </div>
  )
}
