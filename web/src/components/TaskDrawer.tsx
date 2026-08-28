import React, { useState, useEffect } from 'react'
import { X, Clock, ArrowRight, ExternalLink, User } from 'lucide-react'
import { IssueItem, Transition } from '../types'
import { api } from '../api/client'
import { DatePicker } from './DatePicker'
import { DrawerSkeleton } from './Skeleton'

interface TaskDrawerProps {
  issueKey: string | null
  onClose: () => void
  onUpdated?: () => void
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({ issueKey, onClose, onUpdated }) => {
  const [issue, setIssue] = useState<IssueItem | null>(null)
  const [jiraBaseUrl, setJiraBaseUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [transitions, setTransitions] = useState<Transition[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit fields
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [originalEstimate, setOriginalEstimate] = useState('')

  // Quick worklog
  const [worklogTime, setWorklogTime] = useState('')
  const [worklogComment, setWorklogComment] = useState('')

  useEffect(() => {
    api.getConfig().then((cfg) => {
      if (cfg && cfg.url) {
        setJiraBaseUrl(cfg.url.replace(/\/+$/, ''))
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!issueKey) {
      setIssue(null)
      return
    }

    setLoading(true)
    setError(null)

    Promise.all([
      api.getIssue(issueKey),
      api.getTransitions(issueKey).catch(() => []),
    ])
      .then(([issueData, transList]) => {
        setIssue(issueData)
        setSummary(issueData.summary)
        setDescription(issueData.description || '')
        setStartDate(issueData.startDate || '')
        setEndDate(issueData.endDate || '')
        if (issueData.originalEstimateSeconds && issueData.originalEstimateSeconds > 0) {
          const hours = issueData.originalEstimateSeconds / 3600
          setOriginalEstimate(Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`)
        } else {
          setOriginalEstimate('')
        }
        setTransitions(transList)
      })
      .catch((err) => {
        setError(err.message || '加载详情失败')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [issueKey])

  if (!issueKey) return null

  const handleSaveFields = async () => {
    if (!issue) return
    setSaving(true)
    try {
      await api.updateIssue(issue.key, {
        summary,
        description,
        startDate,
        endDate,
        originalEstimate: originalEstimate.trim(),
      })
      if (onUpdated) onUpdated()
      // 重新加载
      const updated = await api.getIssue(issue.key)
      setIssue(updated)
      if (updated.originalEstimateSeconds && updated.originalEstimateSeconds > 0) {
        const hours = updated.originalEstimateSeconds / 3600
        setOriginalEstimate(Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`)
      } else {
        setOriginalEstimate('')
      }
    } catch (err: any) {
      alert('保存失败: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTransition = async (transId: string) => {
    if (!issue) return
    setSaving(true)
    try {
      await api.doTransition({ key: issue.key, transitionId: transId })
      const [updated, newTrans] = await Promise.all([
        api.getIssue(issue.key),
        api.getTransitions(issue.key).catch(() => []),
      ])
      setIssue(updated)
      setTransitions(newTrans)
      if (onUpdated) onUpdated()
    } catch (err: any) {
      alert('状态流转失败: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddWorklog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!issue || !worklogTime.trim()) return
    try {
      await api.addWorklog({
        issueKey: issue.key,
        timeSpent: worklogTime.trim(),
        comment: worklogComment.trim(),
      })
      setWorklogTime('')
      setWorklogComment('')
      alert('工时记录成功！')
      const updated = await api.getIssue(issue.key)
      setIssue(updated)
      if (onUpdated) onUpdated()
    } catch (err: any) {
      alert('登记工时失败: ' + err.message)
    }
  }

  return (
    <>
      <div data-ui="modal-backdrop" onClick={onClose} />
      <div data-ui="drawer-content">
        <div data-ui="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)' }}>
              {issueKey}
            </span>
            {issue?.issueType && (
              <span data-ui="tag" data-status={issue.issueType.toLowerCase() === 'bug' ? 'danger' : 'info'}>
                {issue.issueType}
              </span>
            )}
            {issue?.status && (
              <span
                data-ui="tag"
                data-status={
                  issue.statusCategory === 'Done'
                    ? 'done'
                    : issue.statusCategory === 'In Progress'
                    ? 'in-progress'
                    : 'todo'
                }
              >
                {issue.status}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              data-ui="button"
              data-variant="secondary"
              data-size="sm"
              onClick={() => {
                const baseUrl = (jiraBaseUrl || '').replace(/\/+$/, '')
                window.open(`${baseUrl}/browse/${issueKey}`, '_blank', 'noopener,noreferrer')
              }}
              title="在 Jira 官方系统中打开"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 8px' }}
            >
              <ExternalLink size={13} />
              <span>Jira 打开</span>
            </button>
            <button data-ui="button" data-variant="ghost" onClick={onClose} style={{ padding: '4px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div data-ui="drawer-body">
          {loading && <DrawerSkeleton />}

          {error && (
            <div style={{ padding: '20px', color: 'var(--color-danger)' }}>
              {error}
            </div>
          )}

          {issue && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 父任务导航 */}
              {issue.parentKey && (
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-surface-dim)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>所属父任务:</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{issue.parentKey}</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {issue.parentSummary}
                    </span>
                  </div>
                </div>
              )}

              {/* 标题 */}
              <div data-ui="form-group">
                <label data-ui="form-label">概要 (Summary)</label>
                <input
                  data-ui="input"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  style={{ fontWeight: 600, fontSize: '14px' }}
                />
              </div>

              {/* 状态流转操作区 */}
              {transitions.length > 0 && (
                <div>
                  <label data-ui="form-label" style={{ marginBottom: '8px', display: 'block' }}>
                    流转状态
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {transitions.map((t) => (
                      <button
                        key={t.id}
                        data-ui="button"
                        onClick={() => handleTransition(t.id)}
                        disabled={saving}
                      >
                        <ArrowRight size={13} />
                        <span>流转至 {t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 起止排期与人员 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div data-ui="form-group">
                  <label data-ui="form-label">预计开始日期</label>
                  <DatePicker
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="选择预计开始日期"
                    isClearable
                  />
                </div>

                <div data-ui="form-group">
                  <label data-ui="form-label">预计完成日期</label>
                  <DatePicker
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="选择预计完成日期"
                    isClearable
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div data-ui="form-group">
                  <label data-ui="form-label">经办人</label>
                  <div style={{ fontSize: '13px', fontWeight: 500, padding: '7px 0' }}>
                    {issue.assignee?.displayName || '未指派'}
                  </div>
                </div>

                <div data-ui="form-group">
                  <label data-ui="form-label">预估工时 (如 4h, 8h, 1d)</label>
                  <input
                    data-ui="input"
                    placeholder="例如: 4h, 8h, 2d (支持数字或带单位)"
                    value={originalEstimate}
                    onChange={(e) => setOriginalEstimate(e.target.value)}
                  />
                </div>
              </div>

              {/* 描述 */}
              <div data-ui="form-group">
                <label data-ui="form-label">详细描述</label>
                <textarea
                  data-ui="textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="暂无描述..."
                  style={{ minHeight: '120px' }}
                />
              </div>

              {/* 子任务列表 */}
              {issue.subtasks && issue.subtasks.length > 0 && (
                <div>
                  <label data-ui="form-label" style={{ marginBottom: '8px', display: 'block' }}>
                    子任务列表 ({issue.subtasks.length})
                  </label>
                  <div data-ui="table-container" style={{ overflowX: 'auto' }}>
                    <table data-ui="table" style={{ width: '100%', fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '90px' }}>Key</th>
                          <th>概要</th>
                          <th style={{ width: '95px' }}>经办人</th>
                          <th style={{ width: '150px' }}>起止日期</th>
                          <th style={{ width: '80px' }}>预估工时</th>
                          <th style={{ width: '80px' }}>状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {issue.subtasks.map((sub) => (
                          <tr key={sub.key}>
                            <td>
                              <a
                                href={jiraBaseUrl ? `${jiraBaseUrl}/browse/${sub.key}` : '#'}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  fontWeight: 600,
                                  color: 'var(--color-primary)',
                                  textDecoration: 'underline',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                }}
                                title={`在 Jira 中打开 ${sub.key}`}
                              >
                                <span>{sub.key}</span>
                                <ExternalLink size={10} style={{ opacity: 0.6 }} />
                              </a>
                            </td>
                            <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sub.summary}>
                              {sub.summary}
                            </td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: sub.assignee ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                <User size={11} />
                                <span>{sub.assignee?.displayName || '未指派'}</span>
                              </span>
                            </td>
                            <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {sub.startDate || sub.endDate ? (
                                <span>{sub.startDate || '-'} ~ {sub.endDate || '-'}</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>未排期</span>
                              )}
                            </td>
                            <td>
                              {sub.originalEstimateSeconds && sub.originalEstimateSeconds > 0 ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                  <Clock size={11} color="var(--color-primary)" />
                                  <span>
                                    {sub.originalEstimateSeconds % 3600 === 0
                                      ? `${sub.originalEstimateSeconds / 3600}h`
                                      : `${(sub.originalEstimateSeconds / 3600).toFixed(1)}h`}
                                  </span>
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                              )}
                            </td>
                            <td>
                              <span data-ui="tag" style={{ fontSize: '10.5px', padding: '1px 6px' }}>{sub.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 工时补录 */}
              <div data-ui="card" style={{ padding: '14px', backgroundColor: 'var(--bg-surface-hover)' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={15} />
                  <span>快捷登记工作日志</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: '10px' }}>
                  <input
                    data-ui="input"
                    placeholder="工时 (如 2h, 4h)"
                    value={worklogTime}
                    onChange={(e) => setWorklogTime(e.target.value)}
                  />
                  <input
                    data-ui="input"
                    placeholder="备注说明 (可选)"
                    value={worklogComment}
                    onChange={(e) => setWorklogComment(e.target.value)}
                  />
                  <button data-ui="button" onClick={handleAddWorklog}>
                    填报
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div data-ui="drawer-footer">
          <button data-ui="button" onClick={onClose}>
            关闭
          </button>
          <button
            data-ui="button"
            data-variant="primary"
            onClick={handleSaveFields}
            disabled={saving || !issue}
          >
            {saving ? '保存中...' : '保存更改'}
          </button>
        </div>
      </div>
    </>
  )
}
