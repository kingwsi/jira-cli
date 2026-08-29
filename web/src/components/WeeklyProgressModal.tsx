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
  Building2,
  Tag,
  User,
  FileText,
} from 'lucide-react'
import { api } from '../api/client'
import { IssueItem, CommentItem } from '../types'
import { ModalCommentsSkeleton } from './Skeleton'

export interface WeeklyProgressModalProps {
  issue: IssueItem | null
  onClose: () => void
  onSuccess: () => void
  jiraUrl?: string
}

export type ProgressTarget = 'total' | 'product' | 'dev' | 'test' | 'release' | 'deploy'

export const WeeklyProgressModal: React.FC<WeeklyProgressModalProps> = ({
  issue,
  onClose,
  onSuccess,
  jiraUrl,
}) => {
  if (!issue) return null

  const TOTAL_BLOCKS = 20
  const pr = issue.progressReport
  const initialCurrentProgress = pr?.currentProgress ?? 0
  const defaultLastWeek = pr?.currentProgress ?? pr?.lastWeekProgress ?? 0

  const [activeTargetKey, setActiveTargetKey] = useState<ProgressTarget>('total')
  const [currentProgress, setCurrentProgress] = useState<number>(initialCurrentProgress)
  const [productProgress, setProductProgress] = useState<number>(pr?.productProgress ?? 0)
  const [devProgress, setDevProgress] = useState<number>(pr?.devProgress ?? 0)
  const [testProgress, setTestProgress] = useState<number>(pr?.testProgress ?? 0)
  const [releaseProgress, setReleaseProgress] = useState<number>(pr?.releaseProgress ?? 0)
  const [deployProgress, setDeployProgress] = useState<number>(pr?.deployProgress ?? 0)

  const [hoverProgress, setHoverProgress] = useState<number | null>(null)
  const [lastWeekProgress, setLastWeekProgress] = useState<number>(defaultLastWeek)
  const [comment, setComment] = useState<string>('')

  const [comments, setComments] = useState<CommentItem[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (issue) {
      const cur = issue.progressReport?.currentProgress ?? 0
      setCurrentProgress(cur)
      setProductProgress(issue.progressReport?.productProgress ?? 0)
      setDevProgress(issue.progressReport?.devProgress ?? 0)
      setTestProgress(issue.progressReport?.testProgress ?? 0)
      setReleaseProgress(issue.progressReport?.releaseProgress ?? 0)
      setDeployProgress(issue.progressReport?.deployProgress ?? 0)
      setActiveTargetKey('total')
      setHoverProgress(null)
      setLastWeekProgress(
        issue.progressReport?.currentProgress ??
          issue.progressReport?.lastWeekProgress ??
          0
      )
      setComment('')
      setError(null)

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

  const progressDefs: {
    key: ProgressTarget
    label: string
    shortLabel: string
    value: number
    setter: (val: number) => void
    isSubStage?: boolean
  }[] = [
    { key: 'total', label: '当前总进度', shortLabel: '总进度', value: currentProgress, setter: setCurrentProgress },
    { key: 'product', label: '产品进度', shortLabel: '产品', value: productProgress, setter: setProductProgress, isSubStage: true },
    { key: 'dev', label: '研发进度', shortLabel: '研发', value: devProgress, setter: setDevProgress, isSubStage: true },
    { key: 'test', label: '集成测试', shortLabel: '测试', value: testProgress, setter: setTestProgress, isSubStage: true },
    { key: 'release', label: '发布进度', shortLabel: '发布', value: releaseProgress, setter: setReleaseProgress, isSubStage: true },
    { key: 'deploy', label: '落地进度', shortLabel: '落地', value: deployProgress, setter: setDeployProgress, isSubStage: true },
  ]

  const activeDef = progressDefs.find((p) => p.key === activeTargetKey) || progressDefs[0]
  const activeValue = hoverProgress !== null ? hoverProgress : activeDef.value
  const isComplete = activeValue >= 100
  const themeColor = isComplete ? '#00875a' : '#0052cc'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (currentProgress < 0 || currentProgress > 100) {
      setError('总进度必须在 0% ~ 100% 之间')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await api.updateWeeklyProgress(issue.key, {
        currentProgress,
        lastWeekProgress,
        productProgress: pr?.productProgress !== undefined || productProgress > 0 ? productProgress : undefined,
        devProgress: pr?.devProgress !== undefined || devProgress > 0 ? devProgress : undefined,
        testProgress: pr?.testProgress !== undefined || testProgress > 0 ? testProgress : undefined,
        releaseProgress: pr?.releaseProgress !== undefined || releaseProgress > 0 ? releaseProgress : undefined,
        deployProgress: pr?.deployProgress !== undefined || deployProgress > 0 ? deployProgress : undefined,
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
    <div data-ui="modal-backdrop" onClick={onClose}>
      <div
        data-ui="modal-content"
        style={{
          maxWidth: '640px',
          maxHeight: 'min(720px, 94vh)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal 头部 */}
        <div data-ui="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            <span
              style={{
                fontSize: '12.5px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: '#0052CC',
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
              {jiraUrl && <ExternalLink size={11} />}
            </span>
            <span
              style={{
                fontSize: '14px',
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
            <span
              data-ui="tag"
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {issue.status}
            </span>
          </div>

          <button
            data-ui="button"
            data-variant="ghost"
            data-size="sm"
            onClick={onClose}
            style={{
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal 主体 */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '18px 20px',
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

          {/* 各细分阶段进度快速切换卡片栏 (可点击切换编辑目标) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                height: '18px',
              }}
            >
              <span>点击下方进度可切换更新：</span>
              <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 500 }}>
                当前选择: {activeDef.label}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr repeat(5, 1fr)',
                gap: '6px',
              }}
            >
              {progressDefs.map((p) => {
                const isSelected = activeTargetKey === p.key
                const isValDone = p.value >= 100

                return (
                  <div
                    key={p.key}
                    onClick={() => {
                      setActiveTargetKey(p.key)
                      setHoverProgress(null)
                    }}
                    title={`点击切换到 ${p.label} 进行调整`}
                    style={{
                      backgroundColor: isSelected ? 'rgba(0, 82, 204, 0.08)' : 'var(--bg-app)',
                      border: isSelected ? '1px solid #0052CC' : '1px solid var(--border-subtle)',
                      boxShadow: isSelected ? '0 0 0 1px #0052CC, 0 2px 8px rgba(0, 82, 204, 0.16)' : 'none',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      transition: 'background-color 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        color: isSelected ? '#0052CC' : 'var(--text-muted)',
                        fontWeight: isSelected ? 700 : 500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        lineHeight: 1.2,
                      }}
                    >
                      <span>{p.shortLabel}</span>
                      {isSelected && (
                        <span
                          style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            backgroundColor: '#0052CC',
                            display: 'inline-block',
                          }}
                        />
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: '13.5px',
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        lineHeight: 1.2,
                        color: isValDone ? '#00875A' : isSelected ? '#0052CC' : 'var(--text-primary)',
                      }}
                    >
                      {p.value}%
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 进度编辑器主视窗 (动态与上方选中的项关联，固定高度结构防抖) */}
          <div
            style={{
              border: activeTargetKey === 'total' ? '1px solid var(--border-default)' : '1px solid #0052CC',
              boxShadow: activeTargetKey === 'total' ? 'var(--shadow-sm)' : '0 0 0 1px #0052CC, 0 4px 14px rgba(0, 82, 204, 0.12)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              backgroundColor: 'var(--bg-surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              boxSizing: 'border-box',
            }}
          >
            {/* 顶栏：大字与增量 (定高容器) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                minHeight: '52px',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '2px', height: '16px' }}>
                  正在调整: <span style={{ color: themeColor, fontWeight: 700 }}>{activeDef.label}</span>{' '}
                  {hoverProgress !== null && <span style={{ color: themeColor }}>(预览中，点击确认)</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', height: '34px' }}>
                  <span
                    style={{
                      fontSize: '34px',
                      fontWeight: 800,
                      lineHeight: 1,
                      fontFamily: 'var(--font-mono)',
                      color: themeColor,
                      letterSpacing: '-1px',
                    }}
                  >
                    {activeValue}
                  </span>
                  <span
                    style={{
                      fontSize: '17px',
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      marginLeft: '2px',
                    }}
                  >
                    %
                  </span>
                </div>
              </div>

              {/* 右侧指示器标签 (定高 24px) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', height: '24px', justifyContent: 'center' }}>
                {activeTargetKey === 'total' ? (
                  progressDiff !== 0 ? (
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        color: progressDiff > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                        backgroundColor:
                          progressDiff > 0 ? 'var(--bg-success-subtle)' : 'var(--bg-danger-subtle)',
                        border:
                          progressDiff > 0 ? '1px solid var(--border-success)' : '1px solid var(--border-danger)',
                        lineHeight: 1.2,
                      }}
                    >
                      {progressDiff > 0 ? (
                        <>
                          <TrendingUp size={13} />
                          +{progressDiff}% 较上周
                        </>
                      ) : (
                        <>
                          <TrendingDown size={13} />
                          {progressDiff}% 回退
                        </>
                      )}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '11.5px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                        backgroundColor: 'var(--bg-muted)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        lineHeight: 1.2,
                      }}
                    >
                      较上周持平 ({lastWeekProgress}%)
                    </span>
                  )
                ) : (
                  <span
                    style={{
                      fontSize: '11.5px',
                      color: isComplete ? 'var(--color-success)' : 'var(--text-secondary)',
                      backgroundColor: isComplete ? 'var(--bg-success-subtle)' : 'var(--bg-muted)',
                      border: isComplete ? '1px solid var(--border-success)' : '1px solid var(--border-subtle)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      fontWeight: 600,
                      lineHeight: 1.2,
                    }}
                  >
                    {isComplete ? '已达成 100%' : `设定值: ${activeValue}%`}
                  </span>
                )}
              </div>
            </div>

            {/* 矩形块状进度条（Hover 预览，点击确认） */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                onMouseLeave={() => setHoverProgress(null)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${TOTAL_BLOCKS}, 1fr)`,
                  gap: '3px',
                  height: '22px',
                  userSelect: 'none',
                }}
              >
                {Array.from({ length: TOTAL_BLOCKS }).map((_, idx) => {
                  const blockPercent = (idx + 1) * (100 / TOTAL_BLOCKS)
                  const isCommitted = activeDef.value >= blockPercent
                  const isHovered = hoverProgress !== null && hoverProgress >= blockPercent

                  let bgColor = 'var(--bg-muted)'
                  let borderColor = 'var(--border-default)'

                  if (hoverProgress !== null) {
                    if (hoverProgress >= activeDef.value) {
                      if (isCommitted) {
                        bgColor = themeColor
                        borderColor = themeColor
                      } else if (isHovered) {
                        bgColor = isComplete ? '#57D9A3' : '#4C9AFF'
                        borderColor = isComplete ? '#36B37E' : '#2684FF'
                      }
                    } else {
                      if (isHovered) {
                        bgColor = themeColor
                        borderColor = themeColor
                      } else if (isCommitted) {
                        bgColor = 'rgba(222, 53, 11, 0.22)'
                        borderColor = 'rgba(222, 53, 11, 0.4)'
                      }
                    }
                  } else {
                    if (isCommitted) {
                      bgColor = isComplete ? '#00875A' : '#0052CC'
                      borderColor = isComplete ? '#00875A' : '#0052CC'
                    }
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        activeDef.setter(blockPercent)
                        setHoverProgress(null)
                      }}
                      onMouseEnter={() => setHoverProgress(blockPercent)}
                      title={`点击设置 ${activeDef.label} 为 ${blockPercent}%`}
                      style={{
                        height: '100%',
                        backgroundColor: bgColor,
                        border: `1px solid ${borderColor}`,
                        borderRadius: '2px',
                        cursor: 'pointer',
                        transition: 'all 0.1s ease',
                      }}
                    />
                  )
                })}
              </div>

              {/* 刻度标识与上周基准微调 (定高 24px) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  height: '24px',
                  marginTop: '4px',
                }}
              >
                <span>0%</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '22px', minWidth: '110px' }}>
                  {activeTargetKey === 'total' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>上周基准:</span>
                      <input
                        data-ui="input"
                        type="number"
                        min={0}
                        max={100}
                        value={lastWeekProgress}
                        onChange={(e) => setLastWeekProgress(Number(e.target.value))}
                        style={{
                          width: '44px',
                          height: '22px',
                          textAlign: 'center',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          fontFamily: 'var(--font-mono)',
                          padding: '1px',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      />
                      <span>%</span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>阶段目标: 100%</span>
                  )}
                </div>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* 业务属性信息 */}
          {(pr?.clientName || pr?.category || pr?.productManager || pr?.demandType || pr?.techSolutionDesc) && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '10px 12px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '11.5px',
                color: 'var(--text-secondary)',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '6px 12px',
                }}
              >
                {pr?.clientName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Building2 size={12} style={{ color: 'var(--text-muted)' }} />
                    <span>客户: {pr.clientName}</span>
                  </div>
                )}
                {pr?.category && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Tag size={12} style={{ color: 'var(--text-muted)' }} />
                    <span>分类: {pr.category}</span>
                  </div>
                )}
                {pr?.productManager && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <User size={12} style={{ color: 'var(--text-muted)' }} />
                    <span>PM: {pr.productManager.displayName}</span>
                  </div>
                )}
                {pr?.demandType && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={12} style={{ color: 'var(--text-muted)' }} />
                    <span>类型: {pr.demandType}</span>
                  </div>
                )}
              </div>

              {pr?.techSolutionDesc && (
                <div
                  style={{
                    paddingTop: '6px',
                    borderTop: '1px solid var(--border-subtle)',
                    lineHeight: 1.4,
                    color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>
                    方案/难度说明:
                  </span>
                  {pr.techSolutionDesc}
                </div>
              )}
            </div>
          )}

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
                marginBottom: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <MessageSquare size={13} style={{ color: 'var(--text-muted)' }} />
                <span>本周进展备注</span>
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
                padding: '8px 12px',
                fontSize: '12.5px',
                lineHeight: '1.4',
                resize: 'none',
                borderRadius: 'var(--radius-sm)',
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
                height: '110px',
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
              {loadingComments && <ModalCommentsSkeleton />}

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
                        padding: '6px 10px',
                        backgroundColor: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-sm)',
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
                          lineHeight: 1.4,
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
