import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  CheckCircle2,
  XCircle,
  User,
  UserPlus,
  Search,
  AlertCircle,
  Check,
  Sparkles,
  MessageSquare,
  Clock,
} from 'lucide-react'
import { IssueItem, UserInfo } from '../types'
import { api } from '../api/client'
import { DatePicker } from './DatePicker'
import { getFrequentUsers, loadFrequentUsers, recordUserSelection, UserHistoryItem } from '../utils/recentUsers'

interface QuickResolveModalProps {
  isOpen: boolean
  issue: IssueItem | null
  anchorRect?: DOMRect | null
  title?: string
  initialAction?: 'resolve' | 'assign' | 'reject'
  resolveText?: string
  resolveConfirmText?: string
  resolvePlaceholder?: string
  assignText?: string
  assignConfirmText?: string
  assignPlaceholder?: string
  rejectText?: string
  rejectConfirmText?: string
  rejectPlaceholder?: string
  onClose: () => void
  onResolved: () => void
}

export const QuickResolveModal: React.FC<QuickResolveModalProps> = ({
  isOpen,
  issue,
  anchorRect,
  title,
  initialAction,
  resolveText,
  resolveConfirmText,
  resolvePlaceholder,
  assignText,
  assignConfirmText,
  assignPlaceholder,
  rejectText,
  rejectConfirmText,
  rejectPlaceholder,
  onClose,
  onResolved,
}) => {
  // 流转动作：已解决/完成 (resolve) 或 指派他人 (assign) 或 拒绝 (reject)
  const [action, setAction] = useState<'resolve' | 'assign' | 'reject'>(
    initialAction || 'resolve'
  )
  // 可选备注
  const [comment, setComment] = useState<string>('')
  // 可选耗费工时与日期
  const [timeSpent, setTimeSpent] = useState<string>('')
  const [workDate, setWorkDate] = useState<string>('')

  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null)

  // 选中的流转目标用户（默认问题创建人/报告人）
  const [selectedAssignee, setSelectedAssignee] = useState<{
    name: string
    displayName: string
  } | null>(null)

  // 本地常用成员历史记录 (按选择频次排序)
  const [frequentUsers, setFrequentUsers] = useState<UserHistoryItem[]>([])

  // 成员搜索下拉状态
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [userSearchText, setUserSearchText] = useState('')
  const [remoteUsers, setRemoteUsers] = useState<UserInfo[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const userPickerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAssist = issue?.issueType === '协助'
  const isBug =
    issue?.issueType?.toLowerCase() === 'bug' || issue?.issueType === '缺陷'

  const modalTitle =
    title ||
    (isAssist
      ? '协助流转 · 提请验收'
      : isBug
        ? '缺陷流转'
        : `${issue?.issueType || '任务'}流转`)

  const effectiveResolveText =
    resolveText || (isAssist ? '完成 (验收中)' : isBug ? '已解决' : '完成')

  const effectiveAssignText =
    assignText || (isBug ? '指派他人' : '指派处理')

  const effectiveRejectText =
    rejectText || (isAssist ? '拒绝协助' : isBug ? '拒绝' : '拒绝')

  const effectiveResolveConfirm =
    resolveConfirmText ||
    (isAssist ? '确认流转至验收中' : isBug ? '确认解决' : '确认完成')

  const effectiveAssignConfirm =
    assignConfirmText ||
    (selectedAssignee
      ? `确认指派给 ${selectedAssignee.displayName}`
      : '确认指派')

  const effectiveRejectConfirm =
    rejectConfirmText ||
    (isAssist ? '确认拒绝协助' : isBug ? '确认拒绝' : '确认拒绝')

  const effectiveResolvePlaceholder =
    resolvePlaceholder ||
    (isAssist
      ? '填写协助完成说明（可选，如：已处理完成并配置完毕，请验收）...'
      : '填写解决说明（可选，如：已在最新分支修复）...')

  const effectiveAssignPlaceholder =
    assignPlaceholder ||
    '填写指派说明或排查建议（可选，如：经排查为后端接口异常，请协助修复）...'

  const effectiveRejectPlaceholder =
    rejectPlaceholder ||
    (isAssist
      ? '填写拒绝协助原因（可选，如：非本组业务 / 缺少必要前置信息）...'
      : '填写拒绝原因（可选，如：非缺陷 / 需求如此 / 无法复现）...')

  // 获取当前登录用户
  useEffect(() => {
    if (isOpen) {
      api
        .getCurrentUser()
        .then((u) => {
          if (u) setCurrentUser(u)
        })
        .catch(() => { })
    }
    if (isOpen) {
      setFrequentUsers(getFrequentUsers(6))
      loadFrequentUsers(8)
        .then((list) => setFrequentUsers(list.slice(0, 6)))
        .catch(() => { })
    }
  }, [isOpen])

  // 初始化默认值
  useEffect(() => {
    if (!isOpen || !issue) {
      setAction(initialAction || 'resolve')
      setComment('')
      setSelectedAssignee(null)
      setError(null)
      setUserDropdownOpen(false)
      setUserSearchText('')
      return
    }

    setAction(initialAction || 'resolve')
    setComment('')
    setTimeSpent('')
    setWorkDate(new Date().toISOString().slice(0, 10))

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
  }, [isOpen, issue, initialAction])

  // 远程成员防抖搜索
  useEffect(() => {
    if (!userDropdownOpen) return

    const timer = setTimeout(() => {
      setSearchingUsers(true)
      api
        .searchUsers(userSearchText.trim())
        .then((res) => {
          setRemoteUsers(res || [])
        })
        .catch(() => setRemoteUsers([]))
        .finally(() => setSearchingUsers(false))
    }, 200)

    return () => clearTimeout(timer)
  }, [userSearchText, userDropdownOpen])

  // 点击外部关闭人员搜索下拉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userPickerRef.current &&
        !userPickerRef.current.contains(event.target as Node)
      ) {
        setUserDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  if (!isOpen || !issue) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (action === 'assign') {
      if (!selectedAssignee || !selectedAssignee.name) {
        setError('请选择要指派的目标成员')
        return
      }
    }

    setSubmitting(true)

    try {
      await api.doTransition({
        key: issue.key,
        transitionId: action,
        action: action,
        assignee: selectedAssignee ? selectedAssignee.name : undefined,
        comment: comment.trim() || undefined,
        timeSpent: action === 'resolve' ? (timeSpent.trim() || undefined) : undefined,
        workDate: action === 'resolve' ? (workDate.trim() || undefined) : undefined,
        autoChain: action !== 'assign',
      })
      if (selectedAssignee && selectedAssignee.name) {
        recordUserSelection(selectedAssignee)
      }
      onResolved()
      onClose()
    } catch (err: any) {
      setError(err.message || (action === 'assign' ? '指派任务失败' : '流转状态失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const isReporterSelected = Boolean(
    issue.reporter && selectedAssignee?.name === issue.reporter.name
  )
  const isMyselfSelected = Boolean(
    currentUser && selectedAssignee?.name === currentUser.name
  )
  const isCurrentAssigneeSelected = Boolean(
    issue.assignee && selectedAssignee?.name === issue.assignee.name
  )

  // 计算轻量弹窗位置（贴合触发按钮或居中）
  let popoverStyle: React.CSSProperties = {
    position: 'fixed',
    width: '375px',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-md)',
    boxShadow:
      '0 12px 32px -4px rgba(9, 30, 66, 0.25), 0 4px 12px rgba(9, 30, 66, 0.1)',
    border: '1px solid var(--border-default)',
    zIndex: 65,
    animation: 'modal-enter 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
    overflow: 'hidden',
  }

  if (anchorRect) {
    const popoverWidth = 375
    const popoverHeight = 400
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

      <div
        ref={popoverRef}
        data-ui="quick-resolve-popover"
        style={popoverStyle}
        onClick={(e) => e.stopPropagation()}
      >
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
            <span style={{ fontWeight: 600, fontSize: '13px' }}>{modalTitle}</span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontWeight: 500,
              }}
            >
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
          <div
            style={{
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '11px',
            }}
          >
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

            {/* 1. 快捷选项按钮：解决 vs 指派他人 vs 拒绝 */}
            <div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                }}
              >
                选择处理动作
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '6px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setAction('resolve')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '8px 6px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border:
                      action === 'resolve'
                        ? '2px solid var(--color-success)'
                        : '1px solid var(--border-default)',
                    backgroundColor:
                      action === 'resolve'
                        ? 'var(--bg-success-subtle)'
                        : 'var(--bg-surface)',
                    color:
                      action === 'resolve'
                        ? 'var(--color-success)'
                        : 'var(--text-default)',
                  }}
                >
                  <CheckCircle2
                    size={15}
                    color={
                      action === 'resolve'
                        ? 'var(--color-success)'
                        : 'var(--text-muted)'
                    }
                  />
                  <span>{effectiveResolveText}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAction('assign')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '8px 6px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border:
                      action === 'assign'
                        ? '2px solid var(--color-primary)'
                        : '1px solid var(--border-default)',
                    backgroundColor:
                      action === 'assign'
                        ? 'var(--bg-primary-subtle)'
                        : 'var(--bg-surface)',
                    color:
                      action === 'assign'
                        ? 'var(--color-primary)'
                        : 'var(--text-default)',
                  }}
                >
                  <UserPlus
                    size={15}
                    color={
                      action === 'assign'
                        ? 'var(--color-primary)'
                        : 'var(--text-muted)'
                    }
                  />
                  <span>{effectiveAssignText}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAction('reject')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '8px 6px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border:
                      action === 'reject'
                        ? '2px solid var(--color-danger)'
                        : '1px solid var(--border-default)',
                    backgroundColor:
                      action === 'reject'
                        ? 'var(--bg-danger-subtle)'
                        : 'var(--bg-surface)',
                    color:
                      action === 'reject'
                        ? 'var(--color-danger)'
                        : 'var(--text-default)',
                  }}
                >
                  <XCircle
                    size={15}
                    color={
                      action === 'reject'
                        ? 'var(--color-danger)'
                        : 'var(--text-muted)'
                    }
                  />
                  <span>{effectiveRejectText}</span>
                </button>
              </div>
            </div>

            {/* 2. 人员指派 */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {action === 'assign' ? '指派处理人 (必选)' : '流转经办人'}
                </span>
                {action === 'assign' ? (
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-primary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      fontWeight: 500,
                    }}
                  >
                    <Sparkles size={11} />
                    选择接手该任务的成员
                  </span>
                ) : issue.reporter ? (
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
                    {isAssist ? '默认提出人 (验收人)' : '默认创建人'}
                  </span>
                ) : null}
              </div>

              {/* 快捷选择标签 */}
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  flexWrap: 'wrap',
                  marginBottom: '6px',
                }}
              >
                {issue.reporter && (
                  <button
                    type="button"
                    data-ui="button"
                    data-variant={isReporterSelected ? 'primary' : 'secondary'}
                    data-size="sm"
                    onClick={() =>
                      setSelectedAssignee({
                        name: issue.reporter!.name,
                        displayName:
                          issue.reporter!.displayName || issue.reporter!.name,
                      })
                    }
                    style={{
                      fontSize: '11px',
                      padding: '2px 7px',
                      height: '22px',
                    }}
                  >
                    {isAssist ? '提出人: ' : '创建人: '}
                    {issue.reporter.displayName || issue.reporter.name}
                  </button>
                )}

                {currentUser && (
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
                      padding: '2px 7px',
                      height: '22px',
                    }}
                  >
                    自己 ({currentUser.displayName || currentUser.name})
                  </button>
                )}

                {issue.assignee && (
                  <button
                    type="button"
                    data-ui="button"
                    data-variant={
                      isCurrentAssigneeSelected ? 'primary' : 'secondary'
                    }
                    data-size="sm"
                    onClick={() =>
                      setSelectedAssignee({
                        name: issue.assignee!.name,
                        displayName:
                          issue.assignee!.displayName || issue.assignee!.name,
                      })
                    }
                    style={{
                      fontSize: '11px',
                      padding: '2px 7px',
                      height: '22px',
                    }}
                  >
                    当前: {issue.assignee.displayName || issue.assignee.name}
                  </button>
                )}

                {/* 常用成员快捷标签 (按选择次数排序) */}
                {frequentUsers
                  .filter(
                    (u) =>
                      u.name !== issue.reporter?.name &&
                      u.name !== currentUser?.name &&
                      u.name !== issue.assignee?.name
                  )
                  .slice(0, 4)
                  .map((u) => {
                    const isSelected = selectedAssignee?.name === u.name
                    return (
                      <button
                        key={u.name}
                        type="button"
                        data-ui="button"
                        data-variant={isSelected ? 'primary' : 'secondary'}
                        data-size="sm"
                        onClick={() =>
                          setSelectedAssignee({
                            name: u.name,
                            displayName: u.displayName || u.name,
                          })
                        }
                        style={{
                          fontSize: '11px',
                          padding: '2px 7px',
                          height: '22px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                        title="常用成员"
                      >
                        <span style={{ color: 'var(--color-warning)' }}>★</span>
                        <span>{u.displayName || u.name}</span>
                      </button>
                    )
                  })}
              </div>

              {/* 搜索更多人员输入框 */}
              <div ref={userPickerRef} style={{ position: 'relative' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '3px 8px',
                    backgroundColor: 'var(--bg-surface)',
                    minHeight: '32px',
                    boxSizing: 'border-box',
                    cursor: 'text',
                  }}
                  onClick={() => {
                    inputRef.current?.focus()
                    setUserDropdownOpen(true)
                  }}
                >
                  <Search size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />

                  {/* 选中的用户胶囊标签显示在左侧 */}
                  {selectedAssignee && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: 'var(--bg-primary-subtle)',
                        color: 'var(--color-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '1px 6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <User size={11} />
                      <span>{selectedAssignee.displayName}</span>
                      <span
                        title="清除已选成员"
                        style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', opacity: 0.7 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedAssignee(null)
                          setUserSearchText('')
                          inputRef.current?.focus()
                        }}
                      >
                        <X size={11} />
                      </span>
                    </div>
                  )}

                  <input
                    ref={inputRef}
                    placeholder={
                      selectedAssignee
                        ? '输入以搜索更换...'
                        : action === 'assign'
                          ? '搜索指派给其他成员...'
                          : '搜索经办人...'
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
                      background: 'transparent',
                      fontSize: '12px',
                      flex: 1,
                      minWidth: '80px',
                      color: 'var(--text-default)',
                    }}
                  />
                </div>

                {userDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      maxHeight: '190px',
                      overflowY: 'auto',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                      zIndex: 70,
                    }}
                  >
                    {searchingUsers ? (
                      <div
                        style={{
                          padding: '8px 10px',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                        }}
                      >
                        搜索中...
                      </div>
                    ) : userSearchText.trim() ? (
                      remoteUsers.length > 0 ? (
                        remoteUsers.map((u) => {
                          const isSelected = selectedAssignee?.name === u.name
                          const freqItem = frequentUsers.find((f) => f.name === u.name)
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
                                padding: '6px 10px',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                backgroundColor: isSelected
                                  ? 'var(--bg-surface-hover)'
                                  : 'transparent',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  'var(--bg-surface-hover)'
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected)
                                  e.currentTarget.style.backgroundColor =
                                    'transparent'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <User size={12} color="var(--text-muted)" />
                                <span style={{ fontWeight: 500 }}>
                                  {u.displayName || u.name}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                {freqItem && (
                                  <span
                                    style={{
                                      fontSize: '9.5px',
                                      padding: '1px 5px',
                                      borderRadius: '3px',
                                      backgroundColor: 'var(--bg-primary-subtle)',
                                      color: 'var(--color-primary)',
                                      fontWeight: 500,
                                    }}
                                  >
                                    常用
                                  </span>
                                )}
                                {isSelected && (
                                  <Check size={12} color="var(--color-primary)" />
                                )}
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div
                          style={{
                            padding: '8px 10px',
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                          }}
                        >
                          未找到匹配成员
                        </div>
                      )
                    ) : frequentUsers.length > 0 ? (
                      <>
                        <div
                          style={{
                            padding: '6px 10px 4px',
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            borderBottom: '1px solid var(--border-subtle)',
                          }}
                        >
                          <Sparkles size={11} color="var(--color-warning)" />
                          <span>常用处理人</span>
                        </div>
                        {frequentUsers.map((u) => {
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
                                padding: '6px 10px',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                backgroundColor: isSelected
                                  ? 'var(--bg-surface-hover)'
                                  : 'transparent',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  'var(--bg-surface-hover)'
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected)
                                  e.currentTarget.style.backgroundColor =
                                    'transparent'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <User size={12} color="var(--color-primary)" />
                                <span style={{ fontWeight: 500 }}>
                                  {u.displayName || u.name}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                {isSelected && (
                                  <Check size={12} color="var(--color-primary)" />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </>
                    ) : (
                      <div
                        style={{
                          padding: '8px 10px',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                        }}
                      >
                        输入姓名搜索成员...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 3. 登记耗费工时与发生日期 (可选填，支持快捷选填) */}
            {action === 'resolve' && (
              <div>
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
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Clock size={12} color="var(--color-primary)" />
                    <span>登记工时与日期 (可选)</span>
                  </span>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {['0.5h', '1h', '2h', '4h', '1d'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setTimeSpent(val)}
                        style={{
                          fontSize: '10.5px',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          border:
                            timeSpent === val
                              ? '1px solid var(--color-primary)'
                              : '1px solid var(--border-default)',
                          backgroundColor:
                            timeSpent === val
                              ? 'var(--bg-primary-subtle)'
                              : 'var(--bg-surface)',
                          color:
                            timeSpent === val
                              ? 'var(--color-primary)'
                              : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    placeholder="工时: 如 2h, 4h, 1d"
                    value={timeSpent}
                    onChange={(e) => setTimeSpent(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-surface)',
                      padding: '4px 8px',
                      fontSize: '12px',
                      outline: 'none',
                      height: '32px',
                    }}
                  />
                  <DatePicker
                    value={workDate}
                    onChange={setWorkDate}
                    placeholder="工时日期"
                    style={{ height: '32px' }}
                  />
                </div>
              </div>
            )}

            {/* 4. 备注 可选填写 */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                }}
              >
                <MessageSquare size={12} />
                <span>备注说明 (可选)</span>
              </div>
              <textarea
                placeholder={
                  action === 'resolve'
                    ? effectiveResolvePlaceholder
                    : action === 'assign'
                      ? effectiveAssignPlaceholder
                      : effectiveRejectPlaceholder
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
                backgroundColor:
                  action === 'resolve'
                    ? 'var(--color-success)'
                    : action === 'assign'
                      ? 'var(--color-primary)'
                      : 'var(--color-danger)',
                borderColor:
                  action === 'resolve'
                    ? 'var(--color-success)'
                    : action === 'assign'
                      ? 'var(--color-primary)'
                      : 'var(--color-danger)',
                height: '28px',
                fontSize: '12px',
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {action === 'resolve' ? (
                <CheckCircle2 size={13} />
              ) : action === 'assign' ? (
                <UserPlus size={13} />
              ) : (
                <XCircle size={13} />
              )}
              <span>
                {submitting
                  ? '处理中...'
                  : action === 'resolve'
                    ? effectiveResolveConfirm
                    : action === 'assign'
                      ? effectiveAssignConfirm
                      : effectiveRejectConfirm}
              </span>
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

export default QuickResolveModal
