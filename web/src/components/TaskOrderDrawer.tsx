import React, { useState, useEffect } from 'react'
import {
  X,
  ExternalLink,
  TrendingUp,
  History,
  Send,
  Building2,
  Tag,
  User,
  FileText,
  Eye,
  Edit3,
} from 'lucide-react'
import { IssueItem, CommentItem } from '../types'
import { api } from '../api/client'
import { DrawerSkeleton } from './Skeleton'
import { WeeklyProgressModal } from './WeeklyProgressModal'
import { JiraRenderer } from './JiraRenderer'
import { AttachmentGallery } from './AttachmentGallery'

interface TaskOrderDrawerProps {
  issueKey: string | null
  onClose: () => void
  onUpdated?: () => void
}

export const TaskOrderDrawer: React.FC<TaskOrderDrawerProps> = ({
  issueKey,
  onClose,
  onUpdated,
}) => {
  const [issue, setIssue] = useState<IssueItem | null>(null)
  const [jiraBaseUrl, setJiraBaseUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 评论与历史备注
  const [comments, setComments] = useState<CommentItem[]>([])
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [showWeeklyModal, setShowWeeklyModal] = useState(false)

  // Edit fields
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [isEditingDescription, setIsEditingDescription] = useState(false)

  useEffect(() => {
    api
      .getConfig()
      .then((cfg) => {
        if (cfg && cfg.url) {
          setJiraBaseUrl(cfg.url.replace(/\/+$/, ''))
        }
      })
      .catch(() => { })
  }, [])

  const reloadIssue = (key: string) => {
    return Promise.all([
      api.getIssue(key),
      api.getComments(key).catch(() => []),
    ]).then(([issueData, commentList]) => {
      setIssue(issueData)
      setSummary(issueData.summary)
      setDescription(issueData.description || '')
      setIsEditingDescription(false)
      setComments(commentList || [])
    })
  }

  useEffect(() => {
    if (!issueKey) {
      setIssue(null)
      return
    }

    setLoading(true)
    setError(null)
    setNewComment('')

    reloadIssue(issueKey)
      .catch((err) => {
        setError(err.message || '加载任务令详情失败')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [issueKey])

  if (!issueKey) return null

  const pr = issue?.progressReport

  const handleSaveFields = async () => {
    if (!issue) return
    setSaving(true)
    try {
      await api.updateIssue(issue.key, {
        summary,
        description,
      })
      if (onUpdated) onUpdated()
      await reloadIssue(issue.key)
    } catch (err: any) {
      alert('保存失败: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePostComment = async () => {
    if (!issue || !newComment.trim()) return
    setPostingComment(true)
    try {
      await api.addComment(issue.key, newComment.trim())
      setNewComment('')
      await reloadIssue(issue.key)
      if (onUpdated) onUpdated()
    } catch (err: any) {
      alert('添加备注失败: ' + err.message)
    } finally {
      setPostingComment(false)
    }
  }

  return (
    <>
      <div data-ui="modal-backdrop" onClick={onClose} />
      <div data-ui="drawer-content">
        {/* Drawer 头部 */}
        <div data-ui="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#00875A',
              }}
            >
              {issueKey}
            </span>
            <span
              style={{
                backgroundColor: 'rgba(0, 135, 90, 0.08)',
                color: '#00875A',
                border: '1px solid rgba(0, 135, 90, 0.25)',
                fontWeight: 600,
                fontSize: '11.5px',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              任务令
            </span>
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
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                padding: '4px 8px',
              }}
            >
              <ExternalLink size={13} />
              <span>Jira 打开</span>
            </button>
            <button
              data-ui="button"
              data-variant="ghost"
              onClick={onClose}
              style={{ padding: '4px' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div data-ui="drawer-body">
          {loading && <DrawerSkeleton />}

          {error && (
            <div style={{ padding: '20px', color: 'var(--color-danger)' }}>{error}</div>
          )}

          {issue && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 标题 */}
              <div data-ui="form-group">
                <label data-ui="form-label">任务令概要 (Summary)</label>
                <input
                  data-ui="input"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  style={{ fontWeight: 600, fontSize: '14px' }}
                />
              </div>

              {/* 各个进度概览卡片 */}
              <div
                data-ui="card"
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-surface-hover)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  border: '1px solid var(--border-default)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '13.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <TrendingUp size={16} color="#00875A" />
                    <span>各个进度看板与评估</span>
                  </div>
                  <button
                    data-ui="button"
                    data-size="sm"
                    data-variant="primary"
                    onClick={() => setShowWeeklyModal(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      backgroundColor: '#00875A',
                      borderColor: '#00875A',
                      color: '#fff',
                    }}
                  >
                    <span>查看与更新</span>
                  </button>
                </div>

                {/* 总进度主进度条 */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>当前总进度</span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          backgroundColor:
                            pr?.progressStatus === '正常'
                              ? 'var(--bg-success-subtle)'
                              : 'var(--bg-warning-subtle)',
                          color:
                            pr?.progressStatus === '正常'
                              ? 'var(--color-success)'
                              : 'var(--color-warning)',
                          fontWeight: 600,
                        }}
                      >
                        {pr?.progressStatus || '正常'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {pr?.lastWeekProgress !== undefined && (
                        <span
                          style={{
                            fontSize: '11.5px',
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          上周: {pr.lastWeekProgress}%
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '20px',
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          color:
                            (pr?.currentProgress ?? 0) >= 100
                              ? 'var(--color-success)'
                              : 'var(--color-primary)',
                        }}
                      >
                        {pr?.currentProgress ?? 0}%
                      </span>
                    </div>
                  </div>

                  {/* 矩形块状进度轨道 */}
                  {(() => {
                    const cur = pr?.currentProgress ?? 0
                    const last = pr?.lastWeekProgress ?? cur
                    const diff = cur - last

                    return (
                      <>
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
                            const isCurFilled = cur >= blockPercent
                            const isLastFilled = last >= blockPercent

                            let bg = 'var(--bg-muted)'
                            let border = 'var(--border-default)'

                            if (diff >= 0) {
                              if (isLastFilled) {
                                bg = cur >= 100 ? '#00875A' : '#0052CC'
                                border = cur >= 100 ? '#00875A' : '#0052CC'
                              } else if (isCurFilled) {
                                bg = cur >= 100 ? '#36B37E' : '#4C9AFF'
                                border = cur >= 100 ? '#36B37E' : '#2684FF'
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

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '10.5px',
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                            marginTop: '6px',
                          }}
                        >
                          <span>基准: {last}%</span>
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
                      </>
                    )
                  })()}
                </div>

                {/* 各子阶段进度网格 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>产品进度</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                      {pr?.productProgress !== undefined ? `${pr.productProgress}%` : '-'}
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>研发进度</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                      {pr?.devProgress !== undefined ? `${pr.devProgress}%` : '-'}
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>集成测试</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                      {pr?.testProgress !== undefined ? `${pr.testProgress}%` : '-'}
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>发布进度</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                      {pr?.releaseProgress !== undefined ? `${pr.releaseProgress}%` : '-'}
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>落地进度</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                      {pr?.deployProgress !== undefined ? `${pr.deployProgress}%` : '-'}
                    </div>
                  </div>
                </div>

                {/* 任务令业务分类与说明 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                    <span>客户名称: {pr?.clientName || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Tag size={13} style={{ color: 'var(--text-muted)' }} />
                    <span>业务分类: {pr?.category || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={13} style={{ color: 'var(--text-muted)' }} />
                    <span>产品经理: {pr?.productManager?.displayName || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={13} style={{ color: 'var(--text-muted)' }} />
                    <span>需求类型: {pr?.demandType || '-'}</span>
                  </div>
                </div>

                {pr?.techSolutionDesc && (
                  <div
                    style={{
                      fontSize: '12px',
                      backgroundColor: 'var(--bg-surface)',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>难度/技术方案说明:</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{pr.techSolutionDesc}</div>
                  </div>
                )}
              </div>

              {/* 详细描述 */}
              <div data-ui="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label data-ui="form-label" style={{ margin: 0 }}>详细描述</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      data-ui="button"
                      data-variant={!isEditingDescription ? 'primary' : 'secondary'}
                      data-size="sm"
                      onClick={() => setIsEditingDescription(false)}
                      style={{ padding: '2px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Eye size={12} />
                      <span>预览视图</span>
                    </button>
                    <button
                      type="button"
                      data-ui="button"
                      data-variant={isEditingDescription ? 'primary' : 'secondary'}
                      data-size="sm"
                      onClick={() => setIsEditingDescription(true)}
                      style={{ padding: '2px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Edit3 size={12} />
                      <span>编辑模式</span>
                    </button>
                  </div>
                </div>

                {!isEditingDescription ? (
                  <div
                    style={{
                      padding: '12px 14px',
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-default)',
                      minHeight: '80px',
                      maxHeight: '400px',
                      overflowY: 'auto',
                    }}
                  >
                    {description ? (
                      <JiraRenderer
                        text={description}
                        attachments={issue.attachments}
                        issueKey={issue.key}
                        jiraBaseUrl={jiraBaseUrl}
                      />
                    ) : (
                      <span
                        style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13px', cursor: 'pointer' }}
                        onClick={() => setIsEditingDescription(true)}
                      >
                        暂无详细描述，点击添加...
                      </span>
                    )}
                  </div>
                ) : (
                  <div>
                    <textarea
                      data-ui="textarea"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="暂无描述（支持 Jira 格式及 !image.png! 图片语法）..."
                      style={{ minHeight: '100px' }}
                      autoFocus
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      💡 支持 Jira 语法：<code>!image.png!</code> 插入图片、<code>*加粗*</code>、<code>&#123;code&#125;代码&#123;code&#125;</code> 等
                    </div>
                  </div>
                )}
              </div>

              {/* 附件列表 */}
              {issue.attachments && issue.attachments.length > 0 && (
                <AttachmentGallery
                  attachments={issue.attachments}
                  issueKey={issue.key}
                />
              )}

              {/* 历史周报与备注时间轴 */}
              <div
                data-ui="card"
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontWeight: 700,
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <History size={15} color="#00875A" />
                    <span>历史周报与备注记录 ({comments.length})</span>
                  </div>
                </div>

                {/* 快速追加新备注 */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    data-ui="input"
                    placeholder="输入新的进展备注并同步到 Jira..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handlePostComment()
                      }
                    }}
                    style={{ flex: 1, fontSize: '12.5px', height: '34px' }}
                  />
                  <button
                    data-ui="button"
                    data-variant="primary"
                    data-size="sm"
                    onClick={handlePostComment}
                    disabled={postingComment || !newComment.trim()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: '#00875A',
                      borderColor: '#00875A',
                      color: '#fff',
                    }}
                  >
                    <Send size={12} />
                    <span>{postingComment ? '发送中...' : '发送'}</span>
                  </button>
                </div>

                {/* 历史备注列表 */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                  }}
                >
                  {comments.length === 0 && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        padding: '12px',
                      }}
                    >
                      暂无历史备注记录
                    </div>
                  )}

                  {comments
                    .slice()
                    .reverse()
                    .map((c) => (
                      <div
                        key={c.id}
                        style={{
                          fontSize: '12.5px',
                          padding: '8px 12px',
                          backgroundColor: 'var(--bg-muted)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '4px',
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: '12px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {c.author?.displayName || '用户'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {c.created ? c.created.slice(0, 16).replace('T', ' ') : ''}
                          </span>
                        </div>
                        <div>
                          <JiraRenderer
                            text={c.body}
                            attachments={issue.attachments}
                            issueKey={issue.key}
                            jiraBaseUrl={jiraBaseUrl}
                          />
                        </div>
                      </div>
                    ))}
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
            style={{
              backgroundColor: '#00875A',
              borderColor: '#00875A',
              color: '#fff',
            }}
          >
            {saving ? '保存中...' : '保存更改'}
          </button>
        </div>
      </div>

      {/* 任务令专属周报弹窗 */}
      <WeeklyProgressModal
        issue={showWeeklyModal ? issue : null}
        onClose={() => setShowWeeklyModal(false)}
        onSuccess={() => {
          if (issueKey) reloadIssue(issueKey)
          if (onUpdated) onUpdated()
        }}
        jiraUrl={jiraBaseUrl}
      />
    </>
  )
}

export default TaskOrderDrawer
