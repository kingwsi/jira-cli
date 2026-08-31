import React, { useState, useEffect, useRef } from 'react'
import { X, ZoomIn, ZoomOut, RotateCw, Download, ExternalLink, RefreshCcw } from 'lucide-react'

interface ImageViewerModalProps {
  src: string | null
  alt?: string
  filename?: string
  onClose: () => void
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  src,
  alt = '图片预览',
  filename,
  onClose,
}) => {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!src) return

    // 重置状态
    setScale(1)
    setRotation(0)
    setPosition({ x: 0, y: 0 })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === '=' || e.key === '+') {
        setScale((s) => Math.min(s + 0.25, 4))
      } else if (e.key === '-') {
        setScale((s) => Math.max(s - 0.25, 0.25))
      } else if (e.key === '0') {
        setScale(1)
        setPosition({ x: 0, y: 0 })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [src, onClose])

  if (!src) return null

  const displayName = filename || alt || '图片预览'

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation()
    setScale((s) => Math.min(s + 0.25, 4))
  }

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation()
    setScale((s) => Math.max(s - 0.25, 0.25))
  }

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRotation((r) => (r + 90) % 360)
  }

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation()
    setScale(1)
    setRotation(0)
    setPosition({ x: 0, y: 0 })
  }

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = src
    a.download = displayName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleOpenNewTab = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(src, '_blank', 'noopener,noreferrer')
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY < 0) {
      setScale((s) => Math.min(s + 0.15, 4))
    } else {
      setScale((s) => Math.max(s - 0.15, 0.25))
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* 顶部工具栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          color: '#fff',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 10,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '60%' }}>
          <span
            style={{
              fontWeight: 600,
              fontSize: '14px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: '#f8fafc',
            }}
            title={displayName}
          >
            {displayName}
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '10px',
              color: '#cbd5e1',
            }}
          >
            {Math.round(scale * 100)}%
          </span>
        </div>

        {/* 控制按钮群 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={handleZoomIn}
            title="放大 (+)"
            style={buttonStyle}
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={handleZoomOut}
            title="缩小 (-)"
            style={buttonStyle}
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={handleRotate}
            title="顺时针旋转 90°"
            style={buttonStyle}
          >
            <RotateCw size={16} />
          </button>
          <button
            onClick={handleReset}
            title="重置缩放 (0)"
            style={buttonStyle}
          >
            <RefreshCcw size={16} />
          </button>
          <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.2)', margin: '0 4px' }} />
          <button
            onClick={handleOpenNewTab}
            title="新标签页打开"
            style={buttonStyle}
          >
            <ExternalLink size={16} />
          </button>
          <button
            onClick={handleDownload}
            title="下载图片"
            style={buttonStyle}
          >
            <Download size={16} />
          </button>
          <button
            onClick={onClose}
            title="关闭 (Esc)"
            style={{ ...buttonStyle, backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 图片展示主体 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
        }}
        onMouseDown={handleMouseDown}
      >
        <img
          src={src}
          alt={alt}
          style={{
            maxWidth: scale > 1 ? 'none' : '90vw',
            maxHeight: scale > 1 ? 'none' : '82vh',
            objectFit: 'contain',
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            borderRadius: '6px',
            backgroundColor: '#ffffff',
          }}
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />
      </div>
    </div>
  )
}

const buttonStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.1)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  color: '#e2e8f0',
  borderRadius: '6px',
  padding: '6px 8px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
}
