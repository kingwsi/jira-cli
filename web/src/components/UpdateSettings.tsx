import { useEffect, useRef, useState } from 'react'

type Status = {
  current: string; latest: string; available: boolean; auto: boolean
  supported: boolean; reason: string; busy: boolean; checkedAt: string; error: string
}

async function request(path = '', method = 'GET', body?: unknown): Promise<Status> {
  const response = await fetch(`/api/v1/updates${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || '更新请求失败')
  return result.data
}

export function UpdateSettings() {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [restarting, setRestarting] = useState(false)
  const originalVersion = useRef<string | null>(null)
  useEffect(() => {
    let cancelled = false
    async function refresh() {
      try {
        const next = await request()
        if (cancelled) return
        if (originalVersion.current && originalVersion.current !== next.current) { window.location.reload(); return }
        originalVersion.current = next.current
        setStatus(next)
      } catch (e) { if (!cancelled) setMessage(e instanceof Error ? e.message : '无法获取更新状态') }
    }
    void refresh()
    const timer = window.setInterval(refresh, 10000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [])
  useEffect(() => {
    if (!restarting) return
    let cancelled = false
    let attempts = 0
    const timer = window.setInterval(async () => {
      attempts++
      try {
        const next = await request()
        if (cancelled) return
        if (next.current !== status?.current) { window.location.reload(); return }
      } catch { /* The server is briefly unavailable during restart. */ }
      if (!cancelled && attempts >= 60) {
        setRestarting(false)
        setMessage('尚未确认新版本启动，请检查服务日志后刷新页面。旧程序保存在 .previous 文件中。')
      }
    }, 2000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [restarting, status?.current])

  async function act(path: string, method = 'POST', body?: unknown) {
    setBusy(true); setMessage('')
    try {
      const next = await request(path, method, body)
      setStatus(next)
      if (path === '/install') { setRestarting(true); setMessage('安装完成，正在重启并等待新版本上线…') }
      else if (path === '/check') setMessage(next.available ? '发现新版本，可以安装更新。' : '未发现更高的稳定版本。')
      else setMessage('自动更新设置已保存。')
    } catch (e) { setMessage(e instanceof Error ? e.message : '操作失败') }
    finally { setBusy(false) }
  }
  return <div className="settings-section-card">
    <div className="settings-section-header"><div>
      <h3 className="settings-section-title">版本与更新</h3>
      <p className="settings-section-desc">每 6 小时检查稳定版本；安装后短暂重启，保留 Jira 配置。</p>
    </div></div>
    {status && <>
      <p>当前版本：{status.current}　最新版本：{status.latest || '尚未获取'}</p>
      <p>最近检查：{status.checkedAt ? new Date(status.checkedAt).toLocaleString() : '尚未检查'}</p>
      {!status.supported && <p>{status.reason}</p>}
      <p>更新管理仅限在服务所在机器访问。开发版本不会自动升级。</p>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input type="checkbox" checked={status.auto} disabled={!status.supported || busy || restarting || status.busy}
          onChange={e => act('/config', 'PUT', { auto: e.target.checked })} />
        自动安装新版本（默认关闭）
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button data-ui="button" disabled={busy || restarting || status.busy} onClick={() => act('/check')}>检查版本</button>
        <button data-ui="button" data-variant="primary" disabled={busy || restarting || status.busy || !status.supported || !status.available}
          onClick={() => { if (window.confirm('更新将短暂重启服务，请先保存正在编辑的内容。现在更新？')) void act('/install') }}>立即更新并重启</button>
        <a href="https://nextx.uk/jira-work/" target="_blank" rel="noreferrer" data-ui="button">手动下载</a>
      </div>
      {status.error && <p role="alert">{status.error}</p>}
    </>}
    <p role="status">{busy ? '正在处理，请稍候…' : message}</p>
  </div>
}
