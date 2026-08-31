import React, { useState } from 'react'
import { Attachment } from '../types'
import { ImageViewerModal } from './ImageViewerModal'
import { Paperclip, Download, FileText, FileArchive, FileCode, File } from 'lucide-react'

interface AttachmentGalleryProps {
  attachments?: Attachment[]
  issueKey?: string
  className?: string
}

function formatBytes(bytes?: number, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function isImageAttachment(att: Attachment): boolean {
  if (att.mimeType?.startsWith('image/')) return true
  const lower = att.filename.toLowerCase()
  return (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.bmp')
  )
}

function getFileIcon(filename: string) {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.zip') || lower.endsWith('.tar') || lower.endsWith('.gz') || lower.endsWith('.rar') || lower.endsWith('.7z')) {
    return <FileArchive size={18} color="#f59e0b" />
  }
  if (lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.go') || lower.endsWith('.json') || lower.endsWith('.py') || lower.endsWith('.html')) {
    return <FileCode size={18} color="#3b82f6" />
  }
  if (lower.endsWith('.pdf') || lower.endsWith('.doc') || lower.endsWith('.docx') || lower.endsWith('.txt') || lower.endsWith('.md')) {
    return <FileText size={18} color="#ef4444" />
  }
  return <File size={18} color="#64748b" />
}

export const AttachmentGallery: React.FC<AttachmentGalleryProps> = ({ attachments = [], issueKey: _issueKey, className = '' }) => {
  const [previewImage, setPreviewImage] = useState<{ src: string; filename: string } | null>(null)

  if (!attachments || attachments.length === 0) {
    return null
  }

  return (
    <>
      <div
        className={`attachment-gallery-section ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Paperclip size={15} color="var(--color-primary)" />
            <span>附件列表 ({attachments.length})</span>
          </div>
        </div>

        {/* 附件卡片网格 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '10px',
          }}
        >
          {attachments.map((att) => {
            const isImg = isImageAttachment(att)
            const downloadUrl = att.url || `/api/v1/attachments/${att.id}/${encodeURIComponent(att.filename)}`
            const thumbUrl = `${downloadUrl}?thumb=1`

            return (
              <div
                key={att.id || att.filename}
                style={{
                  borderRadius: '6px',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-surface)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                className="attachment-card"
              >
                {/* 图片缩略图预览区 或 文件图标区 */}
                {isImg ? (
                  <div
                    style={{
                      height: '90px',
                      backgroundColor: 'var(--bg-surface-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                    onClick={() => setPreviewImage({ src: downloadUrl, filename: att.filename })}
                    title={`点击预览大图: ${att.filename}`}
                  >
                    <img
                      src={thumbUrl}
                      alt={att.filename}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        // 如果缩略图失败，回退到原图
                        const img = e.currentTarget
                        if (img.src !== downloadUrl) {
                          img.src = downloadUrl
                        }
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        color: '#fff',
                        fontSize: '10px',
                        padding: '2px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>图片</span>
                      <span>{formatBytes(att.size)}</span>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      height: '90px',
                      backgroundColor: 'var(--bg-surface-dim)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {getFileIcon(att.filename)}
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatBytes(att.size)}
                    </span>
                  </div>
                )}

                {/* 文件信息及操作按钮 */}
                <div
                  style={{
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={att.filename}
                  >
                    {att.filename}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '4px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {att.created ? att.created.slice(0, 10) : ''}
                    </span>

                    <a
                      href={downloadUrl}
                      download={att.filename}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontSize: '11px',
                        color: 'var(--color-primary)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-muted)',
                        textDecoration: 'none',
                      }}
                      title="下载附件"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download size={11} />
                      <span>下载</span>
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 图片放大弹窗 Lightbox */}
      <ImageViewerModal
        src={previewImage?.src || null}
        filename={previewImage?.filename}
        onClose={() => setPreviewImage(null)}
      />
    </>
  )
}

export default AttachmentGallery
