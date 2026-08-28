import React, { useState, useEffect } from 'react'
import {
  X,
  Send,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  History,
  ExternalLink,
  MessageSquare,
} from 'lucide-react'
import { api } from '../api/client'
import { IssueItem, CommentItem } from '../types'

export interface WeeklyProgressModalProps {
  issue: IssueItem | null
  onClose: () => void
  onSuccess: () => void
  jiraUrl?: string
}

export const WeeklyProgressModal: React.FC<WeeklyProgressModalProps> = ({
  issue,
  onClose,
  onSuccess,
  jiraUrl,
}) => {
  if (!issue) return null

  const pr = issue.progressReport
  const initialCurrentProgress = pr?.currentProgress ?? 0
  const defaultLastWeek = pr?.currentProgress ?? pr?.lastWeekProgress ?? 0

  const [currentProgress, setCurrentProgress] = useState<number>(initialCurrentProgress)
  const [lastWeekProgress, setLastWeekProgress] = useState<number>(defaultLastWeek)
  const [progressStatus, setProgressStatus] = useState<string>(pr?.progressStatus || '正常')
  const [comment, setComment] = useState<string>('')

  const [comments, setComments] = useState<CommentItem[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (issue) {
      const cur = issue.progressReport?.currentProgress ?? 0
      setCurrentProgress(cur)
      setLastWeekProgress(
        issue.progressReport?.currentProgress ??
          issue.progressReport?.lastWeekProgress ??
          0
      )
      setProgressStatus(issue.progressReport?.progressStatus || '正常')
      setComment('')
      setError(null)

      // 拉取历史备注
      setLoadingComments(true)
      api
        .getComments(issue.key)
        .then((list) => {
          setComments(list || [])
        })
        .catch((err) => {
          console.warn('获取历史备注失败:', err)
        })
        .finally(() => {
          setLoadingComments(false)
        })
    }
  }, [issue])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (currentProgress < 0 || currentProgress > 100) {
      setError('进度必须在 0% ~ 100% 之间')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await api.updateWeeklyProgress(issue.key, {
        currentProgress,
        lastWeekProgress,
        progressStatus,
        comment: comment.trim() || undefined,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('更新周报失败:', err)
      setError(err.message || '更新失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const progressDiff = currentProgress - lastWeekProgress

  const openJira = () => {
    if (!jiraUrl) return
    window.open(`${jiraUrl}/browse/${issue.key}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(9, 30, 66, 0.54)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        data-ui="card"
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: 'min(640px, 92vh)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          boxShadow:
            '0 20px 32px -8px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal 头部 */}
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-muted)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(0, 135, 90, 0.08)',
                color: '#00875A',
                border: '1px solid rgba(0, 135, 90, 0.25)',
                cursor: jiraUrl ? 'pointer' : 'default',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                flexShrink: 0,
              }}
              onClick={openJira}
              title="在 Jira 中打开"
            >
              {issue.key}
              {jiraUrl && <ExternalLink size={10} />}
            </span>
            <span
              style={{
                fontSize: '13.5px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={issue.summary}
            >
              {issue.summary}
            </span>
          </div>

          <button
            data-ui="button"
            data-variant="ghost"
            data-size="sm"
            onClick={onClose}
            style={{ padding: '4px', borderRadius: '4px', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal 主体 */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '16px 18px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            flex: 1,
          }}
        >
          {error && (
            <div
              style={{
                backgroundColor: 'var(--bg-danger-subtle)',
                border: '1px solid var(--border-danger)',
                color: 'var(--color-danger)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* 进度与状态设定卡片（强调数字与核心数据） */}
          <div
            style={{
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* 当前推进度核心数字区 */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  当前总进度
                </span>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  {progressDiff !== 0 ? (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        color: progressDiff > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                        backgroundColor:
                          progressDiff > 0 ? 'rgba(0, 135, 90, 0.08)' : 'rgba(222, 53, 11, 0.08)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {progressDiff > 0 ? (
                        <>
                          <TrendingUp size={11} />
                          +{progressDiff}%
                        </>
                      ) : (
                        <>
                          <TrendingDown size={11} />
                          {progressDiff}%
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

                  <div style={{ display: 'flex', alignItems: 'baseline' }}>
                    <span
                      style={{
                        fontSize: '28px',
                        fontWeight: 800,
                        lineHeight: 1,
                        fontFamily: 'var(--font-mono)',
                        color:
                          currentProgress >= 100 ? 'var(--color-success)' : 'var(--color-primary)',
                      }}
                    >
                      {currentProgress}
                    </span>
                    <span
                      style={{
                        fontSize: '14px',
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

              {/* 双层叠影对比条 */}
              <div
                style={{
                  position: 'relative',
                  height: '7px',
                  backgroundColor: 'var(--border-default)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '10px',
                }}
              >
                {progressDiff >= 0 ? (
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        width: `${Math.min(100, Math.max(0, currentProgress))}%`,
                        backgroundColor: currentProgress >= 100 ? '#36B37E' : '#4C9AFF',
                        borderRadius: '4px',
                        transition: 'width 0.2s ease',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        width: `${Math.min(100, Math.max(0, lastWeekProgress))}%`,
                        backgroundColor: currentProgress >= 100 ? '#00875A' : '#0052CC',
                        borderRadius: lastWeekProgress >= currentProgress ? '4px' : '4px 0 0 4px',
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        width: `${Math.min(100, Math.max(0, lastWeekProgress))}%`,
                        backgroundColor: 'rgba(222, 53, 11, 0.25)',
                        borderRadius: '4px',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        width: `${Math.min(100, Math.max(0, currentProgress))}%`,
                        backgroundColor: '#DE350B',
                        borderRadius: '4px',
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </>
                )}
              </div>

              {/* 滑块与输入控件 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={currentProgress}
                  onChange={(e) => setCurrentProgress(Number(e.target.value))}
                  style={{
                    flex: 1,
                    accentColor: currentProgress >= 100 ? 'var(--color-success)' : 'var(--color-primary)',
                    cursor: 'pointer',
                    height: '6px',
                  }}
                />
                <input
                  data-ui="input"
                  type="number"
                  min={0}
                  max={100}
                  value={currentProgress}
                  onChange={(e) => setCurrentProgress(Number(e.target.value))}
                  style={{
                    width: '60px',
                    height: '28px',
                    textAlign: 'center',
                    fontSize: '13px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>
            </div>

            {/* 辅助设定：上周基准与状态 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                paddingTop: '10px',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  上周基准 (%)
                </label>
                <input
                  data-ui="input"
                  type="number"
                  min={0}
                  max={100}
                  value={lastWeekProgress}
                  onChange={(e) => setLastWeekProgress(Number(e.target.value))}
                  style={{
                    height: '30px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  进度状态
                </label>
                <select
                  data-ui="select"
                  value={progressStatus}
                  onChange={(e) => setProgressStatus(e.target.value)}
                  style={{ height: '30px', fontSize: '12px', fontWeight: 500 }}
                >
                  <option value="正常">正常</option>
                  <option value="有风险">有风险</option>
                  <option value="已延期">已延期</option>
                  <option value="阻塞">阻塞</option>
                </select>
              </div>
            </div>
          </div>

          {/* 本周进展备注 */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <MessageSquare size={13} style={{ color: 'var(--text-muted)' }} />
                <span>进展备注</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>选填</span>
            </label>
            <textarea
              data-ui="input"
              rows={2}
              placeholder="记录本周主要进展、关键结果或需协调事项..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: '12px',
                lineHeight: '1.4',
                resize: 'none',
              }}
            />
          </div>

          {/* 历史进展记录 */}
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <History size={12} style={{ color: 'var(--text-muted)' }} />
              <span>历史记录 ({comments.length})</span>
            </div>

            <div
              style={{
                height: '115px',
                overflowY: 'auto',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 8px',
                backgroundColor: 'var(--bg-app)',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
              }}
            >
              {loadingComments && (
                <div
                  style={{
                    fontSize: '11.5px',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    padding: '20px 0',
                  }}
                >
                  加载中...
                </div>
              )}

              {!loadingComments && comments.length === 0 && (
                <div
                  style={{
                    fontSize: '11.5px',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    padding: '20px 0',
                  }}
                >
                  暂无历史记录
                </div>
              )}

              {!loadingComments &&
                comments
                  .slice()
                  .reverse()
                  .map((c) => (
                    <div
                      key={c.id}
                      style={{
                        fontSize: '11.5px',
                        padding: '5px 8px',
                        backgroundColor: 'var(--bg-surface)',
                        borderRadius: '4px',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          color: 'var(--text-muted)',
                          fontSize: '10.5px',
                          marginBottom: '2px',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {c.author?.displayName || '用户'}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>
                          {c.created ? c.created.slice(0, 16).replace('T', ' ') : ''}
                        </span>
                      </div>
                      <div
                        style={{
                          color: 'var(--text-primary)',
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.35,
                        }}
                      >
                        {c.body}
                      </div>
                    </div>
                  ))}
            </div>
          </div>

          {/* 操作按钮栏 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '8px',
              paddingTop: '10px',
              borderTop: '1px solid var(--border-subtle)',
              marginTop: 'auto',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              data-ui="button"
              data-variant="secondary"
              data-size="sm"
              onClick={onClose}
              disabled={submitting}
            >
              取消
            </button>
            <button
              type="submit"
              data-ui="button"
              data-variant="primary"
              data-size="sm"
              disabled={submitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#00875A',
                borderColor: '#00875A',
                color: '#fff',
              }}
            >
              {submitting ? (
                <span className="vbg-spinner" />
              ) : (
                <Send size={13} />
              )}
              <span>{submitting ? '提交中...' : '保存更新'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default WeeklyProgressModal
