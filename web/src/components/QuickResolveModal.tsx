import React, { useState, useEffect, useRef } from 'react'
import { X, CheckCircle2, XCircle, User, Search, AlertCircle, Check, Sparkles, MessageSquare } from 'lucide-react'
import { IssueItem, UserInfo } from '../types'
import { api } from '../api/client'

interface QuickResolveModalProps {
  isOpen: boolean
  issue: IssueItem | null
  anchorRect?: DOMRect | null
  onClose: () => void
  onResolved: () => void
}

export const QuickResolveModal: React.FC<QuickResolveModalProps> = ({
  isOpen,
  issue,
  anchorRect,
  onClose,
  onResolved,
}) => {
  // 流转动作：已解决 (resolve) 或 拒绝 (reject)
  const [action, setAction] = useState<'resolve' | 'reject'>('resolve')
  // 可选备注
  const [comment, setComment] = useState<string>('')

  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null)

  // 选中的流转目标用户（默认问题创建人）
  const [selectedAssignee, setSelectedAssignee] = useState<{ name: string; displayName: string } | null>(null)

  // 成员搜索下拉状态
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [userSearchText, setUserSearchText] = useState('')
  const [remoteUsers, setRemoteUsers] = useState<UserInfo[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const userPickerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取当前登录用户
  useEffect(() => {
    if (isOpen) {
      api.getCurrentUser()
        .then((u) => {
          if (u) setCurrentUser(u)
        })
        .catch(() => {})
    }
  }, [isOpen])

  // 初始化默认值
  useEffect(() => {
    if (!isOpen || !issue) {
      setAction('resolve')
      setComment('')
      setSelectedAssignee(null)
      setError(null)
      setUserDropdownOpen(false)
      setUserSearchText('')
      return
    }

    setAction('resolve')
    setComment('')

    // 默认选择问题创建人 / 报告人
    if (issue.reporter && issue.reporter.name) {
      setSelectedAssignee({
        name: issue.reporter.name,
        displayName: issue.reporter.displayName || issue.reporter.name,
      })
    } else if (issue.assignee && issue.assignee.name) {
      setSelectedAssignee({
        name: issue.assignee.name,
        displayName: issue.assignee.displayName || issue.assignee.name,
      })
    } else {
      setSelectedAssignee(null)
    }

    setError(null)
  }, [isOpen, issue])

  // 远程成员防抖搜索
  useEffect(() => {
    if (!userDropdownOpen) return

    const timer = setTimeout(() => {
      setSearchingUsers(true)
      api.searchUsers(userSearchText.trim())
        .then((res) => {
          setRemoteUsers(res || [])
        })
        .catch(() => setRemoteUsers([]))
        .finally(() => setSearchingUsers(false))
    }, 200)

    return () => clearTimeout(timer)
  }, [userDropdownOpen, userSearchText])

  // 点击外部收起用户下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userPickerRef.current && !userPickerRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false)
      }
    }
    if (userDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userDropdownOpen])

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !issue) return null

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    setSubmitting(true)
    setError(null)
    try {
      await api.doTransition({
        key: issue.key,
        action,
        assignee: selectedAssignee ? selectedAssignee.name : undefined,
        comment: comment.trim() || undefined,
        autoChain: true,
      })
      onResolved()
      onClose()
    } catch (err: any) {
      setError(err.message || '流转状态失败')
    } finally {
      setSubmitting(false)
    }
  }

  const isReporterSelected =
    Boolean(issue.reporter && selectedAssignee?.name === issue.reporter.name)
  const isMyselfSelected =
    Boolean(currentUser && selectedAssignee?.name === currentUser.name)
  const isCurrentAssigneeSelected =
    Boolean(issue.assignee && selectedAssignee?.name === issue.assignee.name)

  // 计算轻量弹窗位置（贴合触发按钮或居中）
  let popoverStyle: React.CSSProperties = {
    position: 'fixed',
    width: '360px',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 12px 32px -4px rgba(9, 30, 66, 0.25), 0 4px 12px rgba(9, 30, 66, 0.1)',
    border: '1px solid var(--border-default)',
    zIndex: 65,
    animation: 'modal-enter 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
    overflow: 'hidden',
  }

  if (anchorRect) {
    const popoverWidth = 360
    const popoverHeight = 390
    let right = window.innerWidth - anchorRect.right
    if (right < 16) right = 16
    if (window.innerWidth - right < popoverWidth) {
      right = Math.max(16, window.innerWidth - popoverWidth - 16)
    }

    let top = anchorRect.bottom + 6
    if (top + popoverHeight > window.innerHeight) {
      top = Math.max(16, anchorRect.top - popoverHeight - 6)
    }

    popoverStyle = {
      ...popoverStyle,
      top: `${top}px`,
      right: `${right}px`,
    }
  } else {
    popoverStyle = {
      ...popoverStyle,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    }
  }

  return (
    <>
      {/* 半透明极简蒙层，点击直接收起 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(9, 30, 66, 0.15)',
          zIndex: 60,
        }}
        onClick={onClose}
      />

      <div ref={popoverRef} style={popoverStyle} onClick={(e) => e.stopPropagation()}>
        {/* 顶部标题栏 */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface-hover)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>缺陷流转</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
              {issue.key}
            </span>
          </div>
          <button
            data-ui="button"
            data-variant="ghost"
            onClick={onClose}
            style={{ padding: '2px 4px', height: '22px' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* 弹窗内容区 */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
            {error && (
              <div
                style={{
                  backgroundColor: 'var(--bg-danger-subtle)',
                  borderColor: 'var(--border-danger)',
                  color: 'var(--color-danger)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                }}
              >
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            {/* 1. 两个快捷选项按钮：已解决 vs 拒绝 */}
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                选择流转动作
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setAction('resolve')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: action === 'resolve' ? '2px solid var(--color-success)' : '1px solid var(--border-default)',
                    backgroundColor: action === 'resolve' ? 'var(--bg-success-subtle)' : 'var(--bg-surface)',
                    color: action === 'resolve' ? 'var(--color-success)' : 'var(--text-default)',
                  }}
                >
                  <CheckCircle2 size={16} color={action === 'resolve' ? 'var(--color-success)' : 'var(--text-muted)'} />
                  <span>已解决</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAction('reject')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: action === 'reject' ? '2px solid var(--color-danger)' : '1px solid var(--border-default)',
                    backgroundColor: action === 'reject' ? 'var(--bg-danger-subtle)' : 'var(--bg-surface)',
                    color: action === 'reject' ? 'var(--color-danger)' : 'var(--text-default)',
                  }}
                >
                  <XCircle size={16} color={action === 'reject' ? 'var(--color-danger)' : 'var(--text-muted)'} />
                  <span>拒绝</span>
                </button>
              </div>
            </div>

            {/* 2. 流转人员指派 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>流转经办人</span>
                {issue.reporter && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-primary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    <Sparkles size={11} />
                    默认创建人
                  </span>
                )}
              </div>

              {/* 快捷选择标签 */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                {issue.reporter && (
                  <button
                    type="button"
                    data-ui="button"
                    data-variant={isReporterSelected ? 'primary' : 'secondary'}
                    data-size="sm"
                    onClick={() =>
                      setSelectedAssignee({
                        name: issue.reporter!.name,
                        displayName: issue.reporter!.displayName || issue.reporter!.name,
                      })
                    }
                    style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      height: '24px',
                      borderRadius: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    <User size={11} />
                    <span>创建人: {issue.reporter.displayName || issue.reporter.name}</span>
                    {isReporterSelected && <Check size={11} />}
                  </button>
                )}

                {currentUser && currentUser.name !== issue.reporter?.name && (
                  <button
                    type="button"
                    data-ui="button"
                    data-variant={isMyselfSelected ? 'primary' : 'secondary'}
                    data-size="sm"
                    onClick={() =>
                      setSelectedAssignee({
                        name: currentUser.name,
                        displayName: currentUser.displayName || currentUser.name,
                      })
                    }
                    style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      height: '24px',
                      borderRadius: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    <User size={11} />
                    <span>我自己</span>
                    {isMyselfSelected && <Check size={11} />}
                  </button>
                )}

                {issue.assignee &&
                  issue.assignee.name !== issue.reporter?.name &&
                  issue.assignee.name !== currentUser?.name && (
                    <button
                      type="button"
                      data-ui="button"
                      data-variant={isCurrentAssigneeSelected ? 'primary' : 'secondary'}
                      data-size="sm"
                      onClick={() =>
                        setSelectedAssignee({
                          name: issue.assignee!.name,
                          displayName: issue.assignee!.displayName || issue.assignee!.name,
                        })
                      }
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        height: '24px',
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <User size={11} />
                      <span>原经办: {issue.assignee.displayName || issue.assignee.name}</span>
                      {isCurrentAssigneeSelected && <Check size={11} />}
                    </button>
                  )}
              </div>

              {/* 成员搜索框 */}
              <div ref={userPickerRef} style={{ position: 'relative' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-surface)',
                    padding: '2px 6px',
                    gap: '4px',
                  }}
                >
                  <Search size={12} color="var(--text-muted)" />
                  <input
                    placeholder={
                      selectedAssignee
                        ? `已指派: ${selectedAssignee.displayName}`
                        : '搜索团队其他成员...'
                    }
                    value={userSearchText}
                    onChange={(e) => {
                      setUserSearchText(e.target.value)
                      if (!userDropdownOpen) setUserDropdownOpen(true)
                    }}
                    onFocus={() => setUserDropdownOpen(true)}
                    style={{
                      border: 'none',
                      outline: 'none',
                      flex: 1,
                      height: '24px',
                      fontSize: '12px',
                      background: 'transparent',
                    }}
                  />
                  {selectedAssignee && (
                    <span
                      data-ui="tag"
                      data-status="info"
                      style={{ fontSize: '10px', padding: '1px 4px' }}
                    >
                      {selectedAssignee.displayName}
                    </span>
                  )}
                </div>

                {/* 成员下拉结果 */}
                {userDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 2px)',
                      left: 0,
                      right: 0,
                      maxHeight: '140px',
                      overflowY: 'auto',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      boxShadow: 'var(--shadow-md)',
                      zIndex: 100,
                      padding: '2px 0',
                    }}
                  >
                    {searchingUsers ? (
                      <div style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        搜索中...
                      </div>
                    ) : remoteUsers.length > 0 ? (
                      remoteUsers.map((u) => {
                        const isSelected = selectedAssignee?.name === u.name
                        return (
                          <div
                            key={u.name}
                            onClick={() => {
                              setSelectedAssignee({
                                name: u.name,
                                displayName: u.displayName || u.name,
                              })
                              setUserSearchText('')
                              setUserDropdownOpen(false)
                            }}
                            style={{
                              padding: '5px 10px',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              backgroundColor: isSelected ? 'var(--bg-surface-hover)' : 'transparent',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
                            }}
                          >
                            <span style={{ fontWeight: 500 }}>{u.displayName || u.name}</span>
                            {isSelected && <Check size={12} color="var(--color-primary)" />}
                          </div>
                        )
                      })
                    ) : (
                      <div style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {userSearchText ? '未找到成员' : '输入姓名检索'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 3. 备注 可选填写 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <MessageSquare size={12} />
                <span>备注说明 (可选)</span>
              </div>
              <textarea
                placeholder={
                  action === 'resolve'
                    ? '填写解决说明（可选，如：已在最新分支修复）...'
                    : '填写拒绝原因（可选，如：非缺陷 / 需求如此 / 无法复现）...'
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-surface)',
                  padding: '6px 8px',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* 底部操作按钮 */}
          <div
            style={{
              padding: '8px 14px',
              borderTop: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-surface-hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '6px',
            }}
          >
            <button
              type="button"
              data-ui="button"
              data-size="sm"
              onClick={onClose}
              disabled={submitting}
              style={{ height: '28px', fontSize: '12px', padding: '0 10px' }}
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
                backgroundColor: action === 'resolve' ? 'var(--color-success)' : 'var(--color-danger)',
                borderColor: action === 'resolve' ? 'var(--color-success)' : 'var(--color-danger)',
                height: '28px',
                fontSize: '12px',
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {action === 'resolve' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              <span>
                {submitting
                  ? '流转中...'
                  : action === 'resolve'
                  ? '确认解决'
                  : '确认拒绝'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
