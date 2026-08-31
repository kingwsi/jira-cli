import React, { useState, useRef, useEffect } from 'react'

export interface OverflowTooltipProps {
  text: string
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  subText?: string
  placement?: 'top' | 'bottom'
}

export const OverflowTooltip: React.FC<OverflowTooltipProps> = ({
  text,
  children,
  className = '',
  style = {},
  subText,
  placement = 'top',
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<any>(null)

  const updatePosition = () => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const tooltipWidth = Math.min(420, window.innerWidth - 32)

    let left = rect.left + rect.width / 2 - tooltipWidth / 2
    if (left < 16) left = 16
    if (left + tooltipWidth > window.innerWidth - 16) {
      left = window.innerWidth - tooltipWidth - 16
    }

    let top = rect.top - 8
    if (placement === 'bottom' || top < 50) {
      top = rect.bottom + 8
    }

    setCoords({ top, left })
  }

  const handleMouseEnter = () => {
    if (!containerRef.current) return
    const el = containerRef.current
    const hasOverflow = el.scrollWidth > el.clientWidth + 2
    if (!hasOverflow) return

    timeoutRef.current = setTimeout(() => {
      updatePosition()
      setIsVisible(true)
    }, 120)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsVisible(false)
  }

  useEffect(() => {
    const handleScroll = () => {
      if (isVisible) setIsVisible(false)
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [isVisible])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: 'inline-block',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        ...style,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children || text}

      {/* 自定义轻量级 Tooltip 浮层 */}
      {isVisible && (
        <div
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            transform: coords.top < (containerRef.current?.getBoundingClientRect().top || 0) ? 'translateY(-100%)' : 'translateY(0)',
            zIndex: 99999,
            maxWidth: '420px',
            minWidth: '160px',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            color: '#f8fafc',
            backdropFilter: 'blur(8px)',
            borderRadius: '6px',
            padding: '7px 11px',
            fontSize: '12px',
            lineHeight: 1.45,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            pointerEvents: 'none',
            animation: 'fadeIn 0.12s ease-out',
            textAlign: 'left',
          }}
        >
          <div style={{ fontWeight: 500 }}>{text}</div>
          {subText && (
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
              {subText}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default OverflowTooltip
