import React, { useState, useEffect } from 'react'
import { Settings, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import { ServerConfig } from '../types'

export const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [fields, setFields] = useState<any[]>([])

  useEffect(() => {
    api.getConfig()
      .then((cfg) => {
        setConfig(cfg)
        setUrl(cfg.url || '')
        setUsername(cfg.username || '')
      })
      .catch((err) => {
        console.error('加载配置失败:', err)
      })
  }, [])

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const user = await api.testConnection({ url, username, password: password || undefined })
      setTestResult({
        success: true,
        message: `连通成功！已识别用户: ${user.displayName || user.name}`,
      })
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `连接失败: ${err.message}`,
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setTesting(true)
    try {
      await api.saveConfig({ url, username, password: password || undefined })
      alert('配置已成功保存！')
      setPassword('')
      const updated = await api.getConfig()
      setConfig(updated)
    } catch (err: any) {
      alert('保存失败: ' + err.message)
    } finally {
      setTesting(false)
    }
  }

  const handleFetchFields = async () => {
    try {
      const list = await api.getFields()
      setFields(list)
    } catch (err: any) {
      alert('获取字段失败: ' + err.message)
    }
  }

  return (
    <div data-ui="page-content" style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <Settings size={20} color="var(--color-primary)" />
        <h2 style={{ fontSize: '18px', fontWeight: 700 }}>系统与 Jira 接入配置</h2>
      </div>

      <div data-ui="card" style={{ marginBottom: '24px' }}>
        <div data-ui="card-header">
          <div>
            <div data-ui="card-title">Jira 实例连接配置</div>
            <div data-ui="card-description">配置自托管 Jira 的访问地址与个人凭据 (Basic Auth / API Token)</div>
          </div>
          {config?.isConfigured ? (
            <span data-ui="tag" data-status="success">已配置</span>
          ) : (
            <span data-ui="tag" data-status="warning">未配置</span>
          )}
        </div>

        <form onSubmit={handleSave}>
          <div data-ui="form-group">
            <label data-ui="form-label">Jira Base URL</label>
            <input
              data-ui="input"
              placeholder="https://jira.yourcompany.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div data-ui="form-group">
              <label data-ui="form-label">用户名 (Username)</label>
              <input
                data-ui="input"
                placeholder="jira_username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div data-ui="form-group">
              <label data-ui="form-label">密码 / Token (留空则保持原密码)</label>
              <input
                type="password"
                data-ui="input"
                placeholder={config?.isConfigured ? '•••••••• (已保存)' : '输入密码或 Personal Access Token'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {testResult && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '16px',
                backgroundColor: testResult.success ? 'var(--bg-success-subtle)' : 'var(--bg-danger-subtle)',
                color: testResult.success ? 'var(--color-success)' : 'var(--color-danger)',
                fontSize: '13px',
              }}
            >
              {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              data-ui="button"
              onClick={handleTestConnection}
              disabled={testing || !url || !username}
            >
              {testing ? '测试中...' : '测试连接'}
            </button>
            <button
              type="submit"
              data-ui="button"
              data-variant="primary"
              disabled={testing || !url || !username}
            >
              保存配置
            </button>
          </div>
        </form>
      </div>

      {/* 自定义字段映射检测 */}
      <div data-ui="card">
        <div data-ui="card-header">
          <div>
            <div data-ui="card-title">Jira 字段元数据与映射</div>
            <div data-ui="card-description">
              当前预计开始时间映射: <code>customfield_10300</code>，预计结束时间映射: <code>customfield_10301</code>
            </div>
          </div>
          <button data-ui="button" onClick={handleFetchFields}>
            <RefreshCw size={14} />
            <span>获取 Jira 字段列表</span>
          </button>
        </div>

        {fields.length > 0 && (
          <div data-ui="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table data-ui="table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th>字段 ID</th>
                  <th>字段名称</th>
                  <th>类型</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.id}</td>
                    <td>{f.name}</td>
                    <td>{f.custom ? '自定义字段' : '系统字段'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
