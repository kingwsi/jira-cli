import React, { useState, useRef, useEffect } from 'react'
import { Copy, Check, ExternalLink, GitCommit, Link2 } from 'lucide-react'

export interface CopyKeyButtonProps {
  issueKey: string
  summary?: string
  assigneeName?: string
  jiraUrl?: string
  className?: string
}

export const CopyKeyButton: React.FC<CopyKeyButtonProps> = ({
  issueKey,
  summary = '',
  assigneeName,
  jiraUrl = '',
  className = '',
}) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [copiedType, setCopiedType] = useState<string | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const triggerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<any>(null)

  const cleanBaseUrl = (jiraUrl || '').replace(/\/+$/, '')
  const browseUrl = cleanBaseUrl ? `${cleanBaseUrl}/browse/${issueKey}` : `https://jira.ihotel.cn/browse/${issueKey}`
  const user = assigneeName || '我'

  // 复制模板
  const gitCommitText = `--key=${issueKey} --user=${user} ${summary} ${browseUrl}`
  const titleAndLinkText = `[${issueKey}] ${summary} ${browseUrl}`
  const linkOnlyText = browseUrl

  const updatePopoverPos = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const popoverWidth = 280
    const popoverHeight = 155

    // 计算水平位置：避免超出屏幕右边界，靠右对齐按钮
    let left = rect.right - popoverWidth
    if (left < 16) {
      left = 16
    }
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16
    }

    // 计算垂直位置：优先在下方，空间不足则展示在上方
    let top = rect.bottom + 6
    if (top + popoverHeight > window.innerHeight - 16) {
      top = rect.top - popoverHeight - 6
    }

    setPopoverPos({ top, left })
  }

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsPopoverOpen(false)
    }, 250)
  }

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    updatePopoverPos()
    setIsPopoverOpen((prev) => !prev)
  }

  const handleCopy = (text: string, type: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopiedType(type)
    setTimeout(() => {
      setCopiedType(null)
      setIsPopoverOpen(false)
    }, 600)
  }

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsPopoverOpen(false)
      }
    }

    const handleScroll = () => {
      if (isPopoverOpen) {
        setIsPopoverOpen(false)
      }
    }

    if (isPopoverOpen) {
      document.addEventListener('mousedown', handleDocumentClick)
      window.addEventListener('scroll', handleScroll, true)
    }

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isPopoverOpen])

  return (
    <div
      ref={triggerRef}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        position: 'relative',
        userSelect: 'none',
      }}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        data-ui="button"
        data-variant="secondary"
        data-size="sm"
        onClick={handleTriggerClick}
        title="复制 Git 提交 Key / 标题链接"
        style={{
          padding: '3px 8px',
          fontSize: '11.5px',
          display: 'inline-flex',
          alignItems: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        <span>复制标题</span>
      </button>

      {/* 浮动轻量级 Popover 菜单 */}
      {isPopoverOpen && (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: `${popoverPos.top}px`,
            left: `${popoverPos.left}px`,
            zIndex: 9999,
            width: '280px',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            borderRadius: '8px',
            border: '1px solid var(--border-default, #e2e8f0)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            animation: 'fadeIn 0.15s ease-out',
            textAlign: 'left',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-muted, #94a3b8)',
              padding: '4px 8px 6px 8px',
              borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>快捷复制选项</span>
            <span style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 700 }}>{issueKey}</span>
          </div>

          {/* 1. Git 提交 Key 格式 */}
          <button
            type="button"
            style={popoverItemStyle(copiedType === 'git')}
            onClick={(e) => handleCopy(gitCommitText, 'git', e)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
              <GitCommit size={13} color="var(--color-primary, #3b82f6)" />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'left', overflow: 'hidden' }}>
                <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>
                  Git 提交 Key 格式
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={gitCommitText}
                >
                  --key={issueKey} --user={user} ...
                </span>
              </div>
              {copiedType === 'git' ? (
                <span style={{ fontSize: '11px', color: 'var(--color-success, #22c55e)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <Check size={12} /> 已复制
                </span>
              ) : (
                <Copy size={11} style={{ opacity: 0.5 }} />
              )}
            </div>
          </button>

          {/* 2. 标题与链接 */}
          <button
            type="button"
            style={popoverItemStyle(copiedType === 'title_link')}
            onClick={(e) => handleCopy(titleAndLinkText, 'title_link', e)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
              <Link2 size={13} color="#10b981" />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'left', overflow: 'hidden' }}>
                <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>
                  标题与链接
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={titleAndLinkText}
                >
                  [{issueKey}] {summary}
                </span>
              </div>
              {copiedType === 'title_link' ? (
                <span style={{ fontSize: '11px', color: 'var(--color-success, #22c55e)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <Check size={12} /> 已复制
                </span>
              ) : (
                <Copy size={11} style={{ opacity: 0.5 }} />
              )}
            </div>
          </button>

          {/* 3. 仅 Jira 链接 */}
          <button
            type="button"
            style={popoverItemStyle(copiedType === 'link')}
            onClick={(e) => handleCopy(linkOnlyText, 'link', e)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
              <ExternalLink size={13} color="#6366f1" />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'left', overflow: 'hidden' }}>
                <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>
                  仅 Jira 链接
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={browseUrl}
                >
                  {browseUrl}
                </span>
              </div>
              {copiedType === 'link' ? (
                <span style={{ fontSize: '11px', color: 'var(--color-success, #22c55e)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <Check size={12} /> 已复制
                </span>
              ) : (
                <Copy size={11} style={{ opacity: 0.5 }} />
              )}
            </div>
          </button>
        </div>
      )}
    </div>
  )
}

const popoverItemStyle = (isCopied: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  padding: '6px 8px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: isCopied ? 'var(--bg-success-subtle, #f0fdf4)' : 'transparent',
  cursor: 'pointer',
  transition: 'background-color 0.12s ease',
  width: '100%',
})

export default CopyKeyButton
