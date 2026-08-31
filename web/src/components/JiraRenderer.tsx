import React, { useState } from 'react'
import { Attachment } from '../types'
import { ImageViewerModal } from './ImageViewerModal'
import { Copy, Check, ExternalLink, Image as ImageIcon, AlertCircle } from 'lucide-react'

interface JiraRendererProps {
  text: string
  attachments?: Attachment[]
  issueKey?: string
  jiraBaseUrl?: string
  className?: string
  style?: React.CSSProperties
}

interface ImageBlockProps {
  rawFilename: string
  options?: string
  attachments?: Attachment[]
  issueKey?: string
  onImageClick: (src: string, filename: string) => void
}

const ImageBlock: React.FC<ImageBlockProps> = ({
  rawFilename,
  options = '',
  attachments = [],
  issueKey,
  onImageClick,
}) => {
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)

  // 提取纯文件名（去除可能带有的修饰参数）
  let cleanName = rawFilename.trim()
  // 解析宽高参数，如 |width=300,height=200 或 |thumbnail
  let width: string | undefined
  let height: string | undefined
  let isThumbnail = options.includes('thumbnail')

  if (options) {
    const widthMatch = options.match(/width=(\d+(?:px|%|))/i)
    if (widthMatch) width = widthMatch[1].endsWith('%') || widthMatch[1].endsWith('px') ? widthMatch[1] : `${widthMatch[1]}px`
    const heightMatch = options.match(/height=(\d+(?:px|%|))/i)
    if (heightMatch) height = heightMatch[1].endsWith('%') || heightMatch[1].endsWith('px') ? heightMatch[1] : `${heightMatch[1]}px`
  }

  // 匹配附件对象
  let imageSrc = ''
  let foundAttachment: Attachment | undefined

  if (cleanName.startsWith('http://') || cleanName.startsWith('https://')) {
    imageSrc = cleanName
  } else {
    const targetLower = cleanName.toLowerCase()
    foundAttachment = attachments.find(
      (a) => a.filename.toLowerCase() === targetLower || cleanName.includes(a.filename) || a.filename.includes(cleanName)
    )

    if (foundAttachment) {
      imageSrc = `/api/v1/attachments/${foundAttachment.id}/${encodeURIComponent(foundAttachment.filename)}`
    } else if (issueKey) {
      imageSrc = `/api/v1/issues/${issueKey}/attachments/${encodeURIComponent(cleanName)}`
    } else {
      imageSrc = `/api/v1/attachments/by-name/${encodeURIComponent(cleanName)}`
    }
  }

  return (
    <div
      style={{
        display: 'inline-block',
        margin: '8px 0',
        maxWidth: '100%',
        verticalAlign: 'middle',
      }}
    >
      {!loadError ? (
        <div
          style={{
            position: 'relative',
            display: 'inline-block',
            borderRadius: '6px',
            border: '1px solid var(--border-default, #e2e8f0)',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            overflow: 'hidden',
            cursor: 'zoom-in',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
          className="jira-rendered-image-wrapper"
          onClick={() => onImageClick(imageSrc, cleanName)}
          title={`点击放大查看 ${cleanName}`}
        >
          {loading && (
            <div
              style={{
                width: width || '180px',
                height: height || '120px',
                backgroundColor: 'var(--bg-muted, #f1f5f9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '12px',
                color: 'var(--text-muted, #64748b)',
              }}
            >
              <ImageIcon size={16} className="vbg-spinner" />
              <span>加载图片...</span>
            </div>
          )}
          <img
            src={imageSrc}
            alt={cleanName}
            style={{
              display: loading ? 'none' : 'block',
              maxWidth: width || (isThumbnail ? '240px' : '100%'),
              maxHeight: height || '480px',
              objectFit: 'contain',
            }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false)
              setLoadError(true)
            }}
          />
          {!loading && (
            <div
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                color: 'var(--text-muted, #64748b)',
                backgroundColor: 'var(--bg-surface-dim, #f8fafc)',
                borderTop: '1px solid var(--border-subtle, #f1f5f9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                {cleanName}
              </span>
              <span style={{ fontSize: '10px', opacity: 0.7 }}>点击放大</span>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px dashed var(--border-danger, #fca5a5)',
            backgroundColor: 'var(--bg-danger-subtle, #fef2f2)',
            color: 'var(--color-danger, #ef4444)',
            fontSize: '12px',
          }}
        >
          <AlertCircle size={14} />
          <span>图片加载失败: <strong>{cleanName}</strong></span>
          <a
            href={imageSrc}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--color-primary, #3b82f6)', textDecoration: 'underline', marginLeft: '4px' }}
            onClick={(e) => e.stopPropagation()}
          >
            直接打开
          </a>
        </div>
      )}
    </div>
  )
}

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        margin: '10px 0',
        borderRadius: '6px',
        border: '1px solid var(--border-default, #e2e8f0)',
        backgroundColor: 'var(--bg-code, #1e293b)',
        color: '#f8fafc',
        overflow: 'hidden',
        fontSize: '12.5px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: '11px',
          color: '#94a3b8',
        }}
      >
        <span>{language ? language.toUpperCase() : 'CODE'}</span>
        <button
          onClick={handleCopy}
          style={{
            background: 'none',
            border: 'none',
            color: copied ? '#4ade80' : '#cbd5e1',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? '已复制' : '复制'}</span>
        </button>
      </div>
      <pre style={{ margin: 0, padding: '12px', overflowX: 'auto', lineHeight: 1.5 }}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

export const JiraRenderer: React.FC<JiraRendererProps> = ({
  text,
  attachments = [],
  issueKey,
  jiraBaseUrl,
  className = '',
  style,
}) => {
  const [previewImage, setPreviewImage] = useState<{ src: string; filename: string } | null>(null)

  if (!text || !text.trim()) {
    return <div style={{ color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic', fontSize: '13px' }}>暂无描述内容</div>
  }

  const handleImageClick = (src: string, filename: string) => {
    setPreviewImage({ src, filename })
  }

  // 解析并渲染整段 Jira 文本
  const renderContent = () => {
    const lines = text.split('\n')
    const elements: React.ReactNode[] = []
    let inCodeBlock = false
    let codeContent: string[] = []
    let codeLanguage = ''
    let inQuote = false
    let quoteContent: string[] = []
    let inPanel = false
    let panelTitle = ''
    let panelContent: string[] = []
    let tableRows: string[][] = []
    let tableIsHeader: boolean[] = []

    const flushTable = () => {
      if (tableRows.length === 0) return
      const currentRows = [...tableRows]
      const currentHeaders = [...tableIsHeader]
      tableRows = []
      tableIsHeader = []

      elements.push(
        <div
          key={`table-${elements.length}`}
          data-ui="table-container"
          style={{ margin: '10px 0', overflowX: 'auto' }}
        >
          <table
            data-ui="table"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12.5px',
            }}
          >
            <tbody>
              {currentRows.map((row, rIdx) => {
                const isHeader = currentHeaders[rIdx]
                return (
                  <tr key={rIdx} style={isHeader ? { backgroundColor: 'var(--bg-muted, #f8fafc)', fontWeight: 600 } : undefined}>
                    {row.map((cell, cIdx) => {
                      const CellTag = isHeader ? 'th' : 'td'
                      return (
                        <CellTag
                          key={cIdx}
                          style={{
                            padding: '6px 10px',
                            border: '1px solid var(--border-default, #e2e8f0)',
                            textAlign: 'left',
                          }}
                        >
                          {parseInline(cell)}
                        </CellTag>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // 1. Code Block: {code:java} ... {code} 或 {noformat} ... {noformat}
      if (trimmed.startsWith('{code') || trimmed.startsWith('{noformat}')) {
        flushTable()
        if (inCodeBlock) {
          elements.push(
            <CodeBlock
              key={`code-${elements.length}`}
              code={codeContent.join('\n')}
              language={codeLanguage}
            />
          )
          codeContent = []
          inCodeBlock = false
        } else {
          inCodeBlock = true
          codeContent = []
          const match = trimmed.match(/\{code(?::([a-zA-Z0-9_-]+))?\}/)
          codeLanguage = match && match[1] ? match[1] : ''
        }
        continue
      }
      if (inCodeBlock) {
        if (trimmed === '{code}' || trimmed === '{noformat}') {
          elements.push(
            <CodeBlock
              key={`code-${elements.length}`}
              code={codeContent.join('\n')}
              language={codeLanguage}
            />
          )
          codeContent = []
          inCodeBlock = false
        } else {
          codeContent.push(line)
        }
        continue
      }

      // 2. Quote Block: {quote} ... {quote}
      if (trimmed === '{quote}') {
        flushTable()
        if (inQuote) {
          elements.push(
            <blockquote
              key={`quote-${elements.length}`}
              style={{
                borderLeft: '4px solid var(--color-primary, #3b82f6)',
                margin: '10px 0',
                padding: '6px 14px',
                backgroundColor: 'var(--bg-muted, #f8fafc)',
                borderRadius: '0 4px 4px 0',
                color: 'var(--text-secondary, #475569)',
              }}
            >
              {quoteContent.map((q, qIdx) => (
                <div key={qIdx}>{parseInline(q)}</div>
              ))}
            </blockquote>
          )
          quoteContent = []
          inQuote = false
        } else {
          inQuote = true
          quoteContent = []
        }
        continue
      }
      if (inQuote) {
        quoteContent.push(line)
        continue
      }

      // 3. Panel Block: {panel:title=...} ... {panel}
      if (trimmed.startsWith('{panel')) {
        flushTable()
        if (inPanel) {
          elements.push(
            <div
              key={`panel-${elements.length}`}
              style={{
                border: '1px solid var(--border-default, #e2e8f0)',
                borderRadius: '6px',
                margin: '10px 0',
                overflow: 'hidden',
              }}
            >
              {panelTitle && (
                <div
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'var(--bg-surface-dim, #f1f5f9)',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    borderBottom: '1px solid var(--border-default, #e2e8f0)',
                  }}
                >
                  {panelTitle}
                </div>
              )}
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface, #ffffff)' }}>
                {panelContent.map((p, pIdx) => (
                  <div key={pIdx}>{parseInline(p)}</div>
                ))}
              </div>
            </div>
          )
          panelContent = []
          inPanel = false
        } else {
          inPanel = true
          panelContent = []
          const titleMatch = trimmed.match(/title=([^|{}]+)/)
          panelTitle = titleMatch ? titleMatch[1] : ''
        }
        continue
      }
      if (inPanel) {
        if (trimmed === '{panel}') {
          elements.push(
            <div
              key={`panel-${elements.length}`}
              style={{
                border: '1px solid var(--border-default, #e2e8f0)',
                borderRadius: '6px',
                margin: '10px 0',
                overflow: 'hidden',
              }}
            >
              {panelTitle && (
                <div
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'var(--bg-surface-dim, #f1f5f9)',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    borderBottom: '1px solid var(--border-default, #e2e8f0)',
                  }}
                >
                  {panelTitle}
                </div>
              )}
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface, #ffffff)' }}>
                {panelContent.map((p, pIdx) => (
                  <div key={pIdx}>{parseInline(p)}</div>
                ))}
              </div>
            </div>
          )
          panelContent = []
          inPanel = false
        } else {
          panelContent.push(line)
        }
        continue
      }

      // 4. Single-line Quote: bq. text
      if (trimmed.startsWith('bq. ')) {
        flushTable()
        elements.push(
          <blockquote
            key={`bq-${elements.length}`}
            style={{
              borderLeft: '4px solid var(--color-primary, #3b82f6)',
              margin: '8px 0',
              padding: '4px 12px',
              backgroundColor: 'var(--bg-muted, #f8fafc)',
              borderRadius: '0 4px 4px 0',
              color: 'var(--text-secondary, #475569)',
              fontStyle: 'italic',
            }}
          >
            {parseInline(trimmed.substring(4))}
          </blockquote>
        )
        continue
      }

      // 5. Table rows: ||Header 1||Header 2|| 或 |cell 1|cell 2|
      if (trimmed.startsWith('||') && trimmed.endsWith('||')) {
        const cells = trimmed.split('||').slice(1, -1)
        tableRows.push(cells)
        tableIsHeader.push(true)
        continue
      }
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && !trimmed.startsWith('||')) {
        const cells = trimmed.split('|').slice(1, -1)
        tableRows.push(cells)
        tableIsHeader.push(false)
        continue
      }
      flushTable()

      // 6. Horizontal Rule: ----
      if (trimmed === '----' || trimmed === '***' || trimmed === '---') {
        elements.push(<hr key={`hr-${i}`} style={{ margin: '12px 0', borderColor: 'var(--border-subtle, #e2e8f0)' }} />)
        continue
      }

      // 7. Headings: h1. to h6.
      const headingMatch = line.match(/^h([1-6])\.\s+(.*)$/)
      if (headingMatch) {
        const level = parseInt(headingMatch[1], 10)
        const content = headingMatch[2]
        const headingStyles: Record<number, React.CSSProperties> = {
          1: { fontSize: '18px', fontWeight: 700, margin: '14px 0 6px 0', borderBottom: '1px solid var(--border-default, #e2e8f0)', paddingBottom: '4px' },
          2: { fontSize: '16px', fontWeight: 700, margin: '12px 0 6px 0' },
          3: { fontSize: '14.5px', fontWeight: 600, margin: '10px 0 4px 0' },
          4: { fontSize: '13.5px', fontWeight: 600, margin: '8px 0 4px 0' },
          5: { fontSize: '13px', fontWeight: 600, margin: '6px 0 2px 0' },
          6: { fontSize: '12.5px', fontWeight: 600, margin: '4px 0 2px 0', color: 'var(--text-secondary, #64748b)' },
        }
        const Tag = `h${level}` as keyof JSX.IntrinsicElements
        elements.push(
          <Tag key={`h-${i}`} style={headingStyles[level]}>
            {parseInline(content)}
          </Tag>
        )
        continue
      }

      // 8. Lists: * bullet, # numbered, - dash
      const listMatch = line.match(/^(\*+|\#+|\-+)\s+(.*)$/)
      if (listMatch) {
        const marker = listMatch[1]
        const content = listMatch[2]
        const indentLevel = marker.length - 1
        const isOrdered = marker.startsWith('#')

        elements.push(
          <div
            key={`list-${i}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
              marginLeft: `${indentLevel * 18}px`,
              margin: '3px 0',
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: 'var(--color-primary, #3b82f6)', fontWeight: isOrdered ? 600 : 700, minWidth: '12px' }}>
              {isOrdered ? `${i + 1}.` : '•'}
            </span>
            <div style={{ flex: 1 }}>{parseInline(content)}</div>
          </div>
        )
        continue
      }

      // 9. Blank line
      if (!trimmed) {
        elements.push(<div key={`blank-${i}`} style={{ height: '8px' }} />)
        continue
      }

      // 10. Standard Paragraph
      elements.push(
        <div key={`p-${i}`} style={{ lineHeight: 1.6, margin: '3px 0' }}>
          {parseInline(line)}
        </div>
      )
    }

    flushTable()
    return elements
  }

  // 解析单行内的 Jira 内联标记（加粗、斜体、代码、链接、颜色、图片等）
  const parseInline = (inlineText: string): React.ReactNode[] => {
    if (!inlineText) return []

    // 匹配 !image.png! 或 !image.png|width=200! 等图片标记
    // 匹配 [link text|url] 或 [url] 或 [PROJ-123]
    // 匹配 {{monospace}}
    // 匹配 *bold*
    // 匹配 _italic_
    // 匹配 -deleted-
    // 匹配 +inserted+
    // 匹配 {color:red}text{color}
    const tokenRegex = /(![^\s!|]+(?:\|[^!]+)?!)|(\[([^\]|]+)(?:\|([^\]]+))?\])|(\{\{([^{}]+)\}\})|(\*([^*\n]+)\*)|(_([^_/\n]+)_)|(-([^\-\n]+)-)|(\+([^\+\n]+)\+)|(\{color:([^}]+)\}(.*?)\{color\})/g

    const nodes: React.ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = tokenRegex.exec(inlineText)) !== null) {
      // 插入匹配前的普通文本
      if (match.index > lastIndex) {
        nodes.push(inlineText.substring(lastIndex, match.index))
      }

      const [
        _fullMatch,
        imgToken, // 1: !image.png|options!
        linkToken, // 2: [link text|url]
        linkText, // 3
        linkUrl, // 4
        monoToken, // 5: {{code}}
        monoContent, // 6
        boldToken, // 7: *bold*
        boldContent, // 8
        italicToken, // 9: _italic_
        italicContent, // 10
        delToken, // 11: -del-
        delContent, // 12
        insToken, // 13: +ins+
        insContent, // 14
        colorName, // 15
        colorContent, // 16
      ] = match

      if (imgToken) {
        // 解析图片 !filename.png! 或 !filename.png|options!
        const inside = imgToken.slice(1, -1)
        const [rawName, ...optParts] = inside.split('|')
        nodes.push(
          <ImageBlock
            key={`img-${nodes.length}-${match.index}`}
            rawFilename={rawName}
            options={optParts.join('|')}
            attachments={attachments}
            issueKey={issueKey}
            onImageClick={handleImageClick}
          />
        )
      } else if (linkToken) {
        const text = linkUrl ? linkText : linkText
        const url = linkUrl || linkText
        const isExternal = url.startsWith('http://') || url.startsWith('https://')
        nodes.push(
          <a
            key={`link-${nodes.length}`}
            href={isExternal ? url : (jiraBaseUrl ? `${jiraBaseUrl.replace(/\/+$/, '')}/browse/${url}` : `#${url}`)}
            target="_blank"
            rel="noreferrer"
            style={{
              color: 'var(--color-primary, #3b82f6)',
              textDecoration: 'underline',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
            }}
          >
            <span>{text}</span>
            <ExternalLink size={10} style={{ opacity: 0.7 }} />
          </a>
        )
      } else if (monoToken) {
        nodes.push(
          <code
            key={`mono-${nodes.length}`}
            style={{
              padding: '1px 5px',
              backgroundColor: 'var(--bg-muted, #f1f5f9)',
              color: 'var(--color-primary, #2563eb)',
              borderRadius: '3px',
              fontSize: '0.9em',
              fontFamily: 'monospace',
            }}
          >
            {monoContent}
          </code>
        )
      } else if (boldToken) {
        nodes.push(<strong key={`bold-${nodes.length}`}>{boldContent}</strong>)
      } else if (italicToken) {
        nodes.push(<em key={`italic-${nodes.length}`}>{italicContent}</em>)
      } else if (delToken) {
        nodes.push(<del key={`del-${nodes.length}`}>{delContent}</del>)
      } else if (insToken) {
        nodes.push(<u key={`ins-${nodes.length}`}>{insContent}</u>)
      } else if (colorName) {
        nodes.push(
          <span key={`color-${nodes.length}`} style={{ color: colorName }}>
            {colorContent}
          </span>
        )
      }

      lastIndex = tokenRegex.lastIndex
    }

    // 尾部剩余普通文本
    if (lastIndex < inlineText.length) {
      nodes.push(inlineText.substring(lastIndex))
    }

    return nodes.length > 0 ? nodes : [inlineText]
  }

  return (
    <>
      <div
        className={`jira-renderer-container ${className}`}
        style={{
          color: 'var(--text-primary, #1e293b)',
          fontSize: '13px',
          wordBreak: 'break-word',
          ...style,
        }}
      >
        {renderContent()}
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

export default JiraRenderer
