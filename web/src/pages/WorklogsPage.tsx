import React, { useState, useEffect, useMemo } from 'react'
import { Clock, Calendar, ChevronLeft, ChevronRight, RotateCcw, Search, User } from 'lucide-react'
import { api } from '../api/client'
import { WorklogMatrixResponse } from '../types'
import { TaskDrawer } from '../components/TaskDrawer'

export const WorklogsPage: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const [matrixData, setMatrixData] = useState<WorklogMatrixResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [assigneeFilter, setAssigneeFilter] = useState('currentUser()')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const monthDays = useMemo(() => {
    const [yStr, mStr] = currentMonth.split('-')
    const y = parseInt(yStr, 10)
    const m = parseInt(mStr, 10)
    const totalDays = new Date(y, m, 0).getDate()

    const todayStr = new Date().toISOString().split('T')[0]
    const days = []
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${currentMonth}-${String(d).padStart(2, '0')}`
      const dateObj = new Date(y, m - 1, d)
      const dayOfWeek = dateObj.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const isToday = dateStr === todayStr

      days.push({ day: d, dateStr, dayOfWeek, isWeekend, isToday })
    }
    return days
  }, [currentMonth])

  const loadMatrix = () => {
    setLoading(true)
    api.getWorklogMatrix(currentMonth, assigneeFilter)
      .then(setMatrixData)
      .catch((err) => {
        console.error('加载工时失败:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadMatrix()
  }, [currentMonth, assigneeFilter])

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

  const filteredRows = useMemo(() => {
    if (!matrixData) return []
    if (!searchQuery.trim()) return matrixData.rows
    const q = searchQuery.toLowerCase()
    return matrixData.rows.filter(
      (r) =>
        r.issueKey.toLowerCase().includes(q) ||
        r.issueSummary.toLowerCase().includes(q) ||
        (r.assigneeName && r.assigneeName.toLowerCase().includes(q))
    )
  }, [matrixData, searchQuery])

  return (
    <div data-ui="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '15px' }}>
            <Clock size={18} color="var(--color-primary)" />
            <span>月度工时填报矩阵</span>
          </div>

          {/* 月份切换器 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button data-ui="button" data-size="sm" onClick={handlePrevMonth}>
              <ChevronLeft size={14} />
            </button>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                padding: '4px 12px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Calendar size={14} color="var(--color-primary)" />
              <span>{currentMonth}</span>
            </div>
            <button data-ui="button" data-size="sm" onClick={handleNextMonth}>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* 成员过滤 */}
          <select
            data-ui="select"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            style={{ width: '140px' }}
          >
            <option value="currentUser()">👤 仅我的工时</option>
            <option value="all">👥 全部成员工时</option>
          </select>

          {/* 搜索框 */}
          <div data-ui="search-input" style={{ width: '220px' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {matrixData && (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              当月总工时: <b>{(matrixData.totalSpentSeconds / 3600).toFixed(1)} 小时</b>
            </div>
          )}
          <button data-ui="button" onClick={loadMatrix} disabled={loading}>
            <RotateCcw size={14} className={loading ? 'vbg-spinner' : ''} />
            <span>刷新 ({filteredRows.length})</span>
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          正在聚合月度工时数据...
        </div>
      )}

      {!loading && matrixData && (
        <div data-ui="table-container">
          <table data-ui="table" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Key</th>
                <th style={{ minWidth: '180px' }}>任务概要</th>
                <th style={{ width: '90px' }}>经办人</th>
                <th style={{ width: '80px', textAlign: 'right' }}>总计</th>
                {monthDays.map((d) => (
                  <th
                    key={d.day}
                    style={{
                      width: '32px',
                      padding: '8px 2px',
                      textAlign: 'center',
                      backgroundColor: d.isToday ? '#deebff' : d.isWeekend ? 'rgba(9, 30, 66, 0.04)' : undefined,
                    }}
                  >
                    <div>{d.day}</div>
                    <div style={{ fontSize: '9px', opacity: 0.7 }}>
                      {['日', '一', '二', '三', '四', '五', '六'][d.dayOfWeek]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.issueKey}>
                  <td
                    style={{ fontWeight: 700, color: 'var(--color-primary)', cursor: 'pointer' }}
                    onClick={() => setSelectedKey(row.issueKey)}
                  >
                    {row.issueKey}
                  </td>
                  <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.issueSummary}
                  </td>
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <User size={12} color="var(--text-muted)" />
                      <span>{row.assigneeName}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {(row.totalSpentSeconds / 3600).toFixed(1)}h
                  </td>
                  {monthDays.map((d) => {
                    const spent = row.dailySpentSeconds[d.dateStr] || 0
                    const hours = spent > 0 ? (spent / 3600).toFixed(1) : ''

                    return (
                      <td
                        key={d.day}
                        style={{
                          textAlign: 'center',
                          padding: '6px 2px',
                          backgroundColor: d.isWeekend ? 'rgba(9, 30, 66, 0.02)' : undefined,
                        }}
                      >
                        {hours ? (
                          <span
                            style={{
                              backgroundColor: 'var(--bg-success-subtle)',
                              color: 'var(--color-success)',
                              padding: '2px 4px',
                              borderRadius: '2px',
                              fontWeight: 700,
                              fontSize: '10px',
                            }}
                          >
                            {hours}
                          </span>
                        ) : (
                          <span style={{ color: '#dfe1e6' }}>-</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={monthDays.length + 4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    {searchQuery ? '没有找到匹配的工时记录' : '当月暂无工作日志记录'}
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
        onUpdated={loadMatrix}
      />
    </div>
  )
}
