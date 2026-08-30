import React, { useState, useEffect, useMemo } from 'react'
import {
  Server,
  Database,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Bell,
  Plus,
  Trash2,
  Send,
  Eye,
  Zap,
  Copy,
  Check,
  Search,
  Clock,
  Globe,
  Terminal,
} from 'lucide-react'
import { api } from '../api/client'
import { ReminderConfig, ReminderPreview, ServerConfig } from '../types'

type SettingsTab = 'jira' | 'reminders' | 'fields'

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('jira')
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [fields, setFields] = useState<any[]>([])
  const [fieldsLoading, setFieldsLoading] = useState(false)
  const [fieldFilter, setFieldFilter] = useState('')
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig | null>(null)
  const [reminderBusy, setReminderBusy] = useState(false)
  const [reminderPreview, setReminderPreview] = useState<ReminderPreview | null>(null)
  const [copied, setCopied] = useState(false)

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

  useEffect(() => {
    api.getReminderConfig().then(setReminderConfig).catch((err) => {
      console.error('加载提醒配置失败:', err)
    })
  }, [])

  useEffect(() => {
    api.getFields().then(setFields).catch((err) => {
      console.error('加载字段列表失败:', err)
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
    setFieldsLoading(true)
    try {
      const list = await api.getFields(true)
      setFields(list)
      alert('字段列表已从 Jira 强制同步更新！')
    } catch (err: any) {
      alert('获取字段失败: ' + err.message)
    } finally {
      setFieldsLoading(false)
    }
  }

  const updateReminder = (patch: Partial<ReminderConfig>) => {
    setReminderConfig((current) => current ? { ...current, ...patch } : current)
  }

  const addChannel = (type: 'telegram' | 'webhook') => {
    if (!reminderConfig) return
    const id = globalThis.crypto?.randomUUID?.() || `channel-${Date.now()}`
    updateReminder({
      channels: [...reminderConfig.channels, {
        id,
        type,
        name: type === 'telegram' ? 'Telegram Bot' : 'Webhook 机器人',
        enabled: true,
      }],
    })
  }

  const updateChannel = (id: string, patch: Record<string, unknown>) => {
    if (!reminderConfig) return
    updateReminder({
      channels: reminderConfig.channels.map((channel) =>
        channel.id === id ? { ...channel, ...patch } : channel
      ),
    })
  }

  const saveReminders = async () => {
    if (!reminderConfig) return
    setReminderBusy(true)
    try {
      const saved = await api.saveReminderConfig(reminderConfig)
      setReminderConfig(saved)
      alert('提醒配置已保存')
    } catch (err: any) {
      alert('保存失败: ' + err.message)
    } finally {
      setReminderBusy(false)
    }
  }

  const runReminderAction = async (action: 'preview' | 'test' | 'send') => {
    setReminderBusy(true)
    try {
      if (action === 'test') {
        await api.testReminderChannels()
        alert('测试消息已发送至所有已启用的通道')
      } else {
        const result = action === 'preview' ? await api.previewReminders() : await api.sendRemindersNow()
        setReminderPreview(result)
        if (action === 'send') {
          alert(result.sent ? '提醒已检查并推送至各通道' : '检查完成，没有需要提醒的事项')
        }
      }
    } catch (err: any) {
      alert('操作失败: ' + err.message)
    } finally {
      setReminderBusy(false)
    }
  }

  const handleCopyPreview = () => {
    if (!reminderPreview?.message) return
    navigator.clipboard.writeText(reminderPreview.message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filteredFields = useMemo(() => {
    if (!fieldFilter.trim()) return fields
    const term = fieldFilter.toLowerCase().trim()
    return fields.filter(
      (f) =>
        f.id?.toLowerCase().includes(term) ||
        f.name?.toLowerCase().includes(term) ||
        (f.custom ? '自定义' : '系统').includes(term)
    )
  }, [fields, fieldFilter])

  return (
    <div data-ui="page-content" data-page="settings">
      <div className="settings-container">
        {/* Top Header */}
        <div className="settings-page-header">
          <h2>系统与 Jira 接入配置</h2>
          <p>管理 Jira 实例连接鉴权、自动化工时与任务提醒策略，以及同步字段元数据映射</p>
        </div>

        {/* Master-Detail Layout (Left Nav + Right Panel) */}
        <div className="settings-layout">
          {/* Left Navigation Menu */}
          <nav className="settings-nav" aria-label="设置菜单">
            <button
              type="button"
              className={`settings-nav-item ${activeTab === 'jira' ? 'active' : ''}`}
              onClick={() => setActiveTab('jira')}
            >
              <div className="settings-nav-label">
                <Server size={15} />
                <span>Jira 实例连接</span>
              </div>
              <span className={`settings-nav-badge ${config?.isConfigured ? 'success' : 'warning'}`}>
                {config?.isConfigured ? '已连接' : '未配置'}
              </span>
            </button>

            <button
              type="button"
              className={`settings-nav-item ${activeTab === 'reminders' ? 'active' : ''}`}
              onClick={() => setActiveTab('reminders')}
            >
              <div className="settings-nav-label">
                <Bell size={15} />
                <span>个人提醒与推送</span>
              </div>
              <span className={`settings-nav-badge ${reminderConfig?.enabled ? 'success' : 'neutral'}`}>
                {reminderConfig?.enabled ? '已启用' : '已停用'}
              </span>
            </button>

            <button
              type="button"
              className={`settings-nav-item ${activeTab === 'fields' ? 'active' : ''}`}
              onClick={() => setActiveTab('fields')}
            >
              <div className="settings-nav-label">
                <Sliders size={15} />
                <span>字段元数据映射</span>
              </div>
              <span className="settings-nav-badge neutral">
                {fields.length > 0 ? `${fields.length} 项` : '未同步'}
              </span>
            </button>
          </nav>

          {/* Right Content Area */}
          <div className="settings-content-panel">
            {/* Tab 1: Jira Connection */}
            {activeTab === 'jira' && (
              <div className="settings-section-card">
                <div className="settings-section-header">
                  <div>
                    <h3 className="settings-section-title">Jira 实例连接配置</h3>
                    <p className="settings-section-desc">配置自托管 Jira Server / Data Center 的访问地址与个人鉴权凭据</p>
                  </div>
                  {config?.isConfigured ? (
                    <span data-ui="tag" data-status="success">已连接</span>
                  ) : (
                    <span data-ui="tag" data-status="warning">未配置</span>
                  )}
                </div>

                <form onSubmit={handleSave}>
                  <div data-ui="form-group">
                    <label data-ui="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Globe size={13} style={{ color: 'var(--text-muted)' }} />
                      Jira Base URL
                    </label>
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
                      <label data-ui="form-label">密码 / API Token</label>
                      <input
                        type="password"
                        data-ui="input"
                        placeholder={config?.isConfigured ? '•••••••• (已保存，留空保持不变)' : '输入密码或 Personal Access Token'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  {testResult && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '16px',
                        backgroundColor: testResult.success ? 'var(--bg-success-subtle)' : 'var(--bg-danger-subtle)',
                        color: testResult.success ? 'var(--color-success)' : 'var(--color-danger)',
                        fontSize: '13px',
                      }}
                    >
                      {testResult.success ? (
                        <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                      ) : (
                        <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                      type="button"
                      data-ui="button"
                      onClick={handleTestConnection}
                      disabled={testing || !url || !username}
                    >
                      {testing ? (
                        <>
                          <RefreshCw size={13} className="spin" />
                          <span>测试中...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={13} />
                          <span>测试连接</span>
                        </>
                      )}
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
            )}

            {/* Tab 2: Reminders & Push Channels */}
            {activeTab === 'reminders' && reminderConfig && (
              <div className="settings-section-card">
                <div className="settings-section-header">
                  <div>
                    <h3 className="settings-section-title">个人提醒与消息推送</h3>
                    <p className="settings-section-desc">
                      定时自动检查工时填报、到期与逾期任务，按通道推送消息；同一天最多自动执行一次。
                    </p>
                  </div>

                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      checked={reminderConfig.enabled}
                      onChange={(e) => updateReminder({ enabled: e.target.checked })}
                    />
                    <span className="settings-slider" />
                    <span>{reminderConfig.enabled ? '已启用自动提醒' : '已停用'}</span>
                  </label>
                </div>

                {/* Schedule Rules */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
                    定时调度规则
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: reminderConfig.schedule.type === 'weekday' ? '1.4fr 1fr 1fr' : '1.8fr 1fr',
                      gap: '12px',
                      padding: '14px 16px',
                      backgroundColor: 'var(--bg-surface-dim)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: '10px',
                    }}
                  >
                    <div data-ui="form-group" style={{ marginBottom: 0 }}>
                      <label data-ui="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        提醒周期规则
                      </label>
                      <select
                        data-ui="select"
                        value={reminderConfig.schedule.type}
                        onChange={(e) =>
                          updateReminder({
                            schedule: {
                              ...reminderConfig.schedule,
                              type: e.target.value as ReminderConfig['schedule']['type'],
                            },
                          })
                        }
                      >
                        <option value="last_workday_of_week">每周最后一个工作日</option>
                        <option value="weekday">指定星期</option>
                      </select>
                    </div>

                    {reminderConfig.schedule.type === 'weekday' && (
                      <div data-ui="form-group" style={{ marginBottom: 0 }}>
                        <label data-ui="form-label">星期</label>
                        <select
                          data-ui="select"
                          value={reminderConfig.schedule.weekday}
                          onChange={(e) =>
                            updateReminder({
                              schedule: { ...reminderConfig.schedule, weekday: Number(e.target.value) },
                            })
                          }
                        >
                          <option value={1}>周一 (Monday)</option>
                          <option value={2}>周二 (Tuesday)</option>
                          <option value={3}>周三 (Wednesday)</option>
                          <option value={4}>周四 (Thursday)</option>
                          <option value={5}>周五 (Friday)</option>
                          <option value={6}>周六 (Saturday)</option>
                          <option value={0}>周日 (Sunday)</option>
                        </select>
                      </div>
                    )}

                    <div data-ui="form-group" style={{ marginBottom: 0 }}>
                      <label data-ui="form-label">执行时间</label>
                      <input
                        data-ui="input"
                        type="time"
                        value={reminderConfig.schedule.time}
                        onChange={(e) =>
                          updateReminder({
                            schedule: { ...reminderConfig.schedule, time: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-info-subtle)',
                      color: 'var(--color-info)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>默认检查项：未填写工时、已到期/已逾期任务、需求中的任务令超过 7 天未更新。</span>
                  </div>
                </div>

                {/* Message Channels */}
                <div style={{ marginBottom: '24px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        消息推送通道
                      </span>
                      <span data-ui="tag" style={{ fontSize: '11px' }}>
                        {reminderConfig.channels.length} 个通道
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button data-ui="button" data-size="sm" type="button" onClick={() => addChannel('telegram')}>
                        <Plus size={13} /> Telegram
                      </button>
                      <button data-ui="button" data-size="sm" type="button" onClick={() => addChannel('webhook')}>
                        <Plus size={13} /> Webhook
                      </button>
                    </div>
                  </div>

                  {reminderConfig.channels.length === 0 ? (
                    <div className="settings-empty-state">
                      <Bell size={22} />
                      <div>暂无已配置的消息通道，点击右上角按钮添加 Telegram 或 Webhook</div>
                    </div>
                  ) : (
                    reminderConfig.channels.map((channel) => (
                      <div key={channel.id} className="settings-channel-card">
                        <div className="settings-channel-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label className="settings-switch">
                              <input
                                type="checkbox"
                                checked={channel.enabled}
                                onChange={(e) => updateChannel(channel.id, { enabled: e.target.checked })}
                              />
                              <span className="settings-slider" />
                            </label>
                            <span className={`settings-channel-type-badge ${channel.type}`}>
                              {channel.type === 'telegram' ? 'Telegram' : 'Webhook'}
                            </span>
                            <input
                              data-ui="input"
                              placeholder="通道名称"
                              value={channel.name}
                              onChange={(e) => updateChannel(channel.id, { name: e.target.value })}
                              style={{
                                width: '160px',
                                padding: '3px 8px',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            />
                          </div>

                          <button
                            data-ui="button"
                            data-variant="ghost"
                            data-size="sm"
                            type="button"
                            title="删除此通道"
                            onClick={() =>
                              updateReminder({
                                channels: reminderConfig.channels.filter((item) => item.id !== channel.id),
                              })
                            }
                            style={{ color: 'var(--color-danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {channel.type === 'telegram' ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                            <div data-ui="form-group" style={{ marginBottom: 0 }}>
                              <label data-ui="form-label" style={{ fontSize: '11px' }}>Bot Token</label>
                              <input
                                data-ui="input"
                                type="password"
                                placeholder={channel.secretConfigured ? '•••••••• (已保存，留空保持)' : '从 @BotFather 获取'}
                                value={channel.botToken || ''}
                                onChange={(e) => updateChannel(channel.id, { botToken: e.target.value })}
                                style={{ fontSize: '12px' }}
                              />
                            </div>
                            <div data-ui="form-group" style={{ marginBottom: 0 }}>
                              <label data-ui="form-label" style={{ fontSize: '11px' }}>Chat ID</label>
                              <input
                                data-ui="input"
                                placeholder="如: -100123456789 或 用户ID"
                                value={channel.chatId || ''}
                                onChange={(e) => updateChannel(channel.id, { chatId: e.target.value })}
                                style={{ fontSize: '12px' }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div data-ui="form-group" style={{ marginBottom: 0 }}>
                            <label data-ui="form-label" style={{ fontSize: '11px' }}>
                              Webhook URL (POST 接收 JSON: <code>{`{ "text": "..." }`}</code>)
                            </label>
                            <input
                              data-ui="input"
                              type="password"
                              placeholder={channel.secretConfigured ? '•••••••• (已保存，留空保持)' : 'https://oapi.dingtalk.com/robot/send?access_token=...'}
                              value={channel.webhookUrl || ''}
                              onChange={(e) => updateChannel(channel.id, { webhookUrl: e.target.value })}
                              style={{ fontSize: '12px' }}
                            />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Operations & Trigger Buttons */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    data-ui="button"
                    data-variant="primary"
                    type="button"
                    disabled={reminderBusy}
                    onClick={saveReminders}
                  >
                    保存提醒配置
                  </button>
                  <button
                    data-ui="button"
                    type="button"
                    disabled={reminderBusy}
                    onClick={() => runReminderAction('preview')}
                  >
                    <Eye size={13} />
                    <span>只检查不发送 (预览)</span>
                  </button>
                  <button
                    data-ui="button"
                    type="button"
                    disabled={reminderBusy || reminderConfig.channels.length === 0}
                    onClick={() => runReminderAction('test')}
                  >
                    <Send size={13} />
                    <span>发送测试消息</span>
                  </button>
                  <button
                    data-ui="button"
                    type="button"
                    disabled={reminderBusy || reminderConfig.channels.length === 0}
                    onClick={() => runReminderAction('send')}
                  >
                    <Zap size={13} />
                    <span>立即检查并推送</span>
                  </button>
                </div>

                {/* Live Console Output for Reminder Check */}
                {reminderPreview && (
                  <div className="settings-console">
                    <div className="settings-console-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Terminal size={13} />
                        <span>提醒检查输出预览</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyPreview}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'transparent',
                          border: 'none',
                          color: '#a0aec0',
                          cursor: 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        {copied ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
                        <span>{copied ? '已复制' : '复制内容'}</span>
                      </button>
                    </div>
                    <pre className="settings-console-body">{reminderPreview.message}</pre>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Jira Fields & Metadata */}
            {activeTab === 'fields' && (
              <div className="settings-section-card">
                <div className="settings-section-header">
                  <div>
                    <h3 className="settings-section-title">Jira 字段元数据与映射</h3>
                    <p className="settings-section-desc">系统排期及时间字段的自定义字段映射关系，支持从 Jira 实时同步</p>
                  </div>
                  <button
                    data-ui="button"
                    onClick={handleFetchFields}
                    disabled={fieldsLoading || !config?.isConfigured}
                  >
                    <RefreshCw size={13} className={fieldsLoading ? 'spin' : ''} />
                    <span>{fieldsLoading ? '同步中...' : '从 Jira 同步字段列表'}</span>
                  </button>
                </div>

                {/* Key Field Mappings */}
                <div className="settings-mapping-grid">
                  <div className="settings-mapping-box">
                    <div className="settings-mapping-label">预计开始时间映射 (Start Date)</div>
                    <div className="settings-mapping-value">customfield_10300</div>
                  </div>
                  <div className="settings-mapping-box">
                    <div className="settings-mapping-label">预计结束时间映射 (End Date / Due Date)</div>
                    <div className="settings-mapping-value">customfield_10301</div>
                  </div>
                </div>

                {fields.length > 0 ? (
                  <div>
                    <div style={{ marginBottom: '12px', position: 'relative' }}>
                      <input
                        data-ui="input"
                        placeholder="搜索字段名称或 ID..."
                        value={fieldFilter}
                        onChange={(e) => setFieldFilter(e.target.value)}
                        style={{ paddingLeft: '32px' }}
                      />
                      <Search
                        size={14}
                        style={{
                          position: 'absolute',
                          left: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--text-muted)',
                        }}
                      />
                    </div>

                    <div
                      data-ui="table-container"
                      style={{
                        maxHeight: '380px',
                        overflowY: 'auto',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <table data-ui="table" style={{ margin: 0 }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
                          <tr>
                            <th style={{ width: '220px' }}>字段 ID</th>
                            <th>字段名称</th>
                            <th style={{ width: '100px' }}>类型</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredFields.map((f) => (
                            <tr key={f.id}>
                              <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{f.id}</td>
                              <td>{f.name}</td>
                              <td>
                                <span
                                  data-ui="tag"
                                  data-status={f.custom ? 'info' : 'default'}
                                  style={{ fontSize: '11px' }}
                                >
                                  {f.custom ? '自定义' : '系统'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right' }}>
                      共 {fields.length} 个字段 {fieldFilter && `(筛选出 ${filteredFields.length} 个)`}
                    </div>
                  </div>
                ) : (
                  <div className="settings-empty-state">
                    <Database size={28} />
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>尚未同步 Jira 实例字段</div>
                    <div>点击右上角“从 Jira 同步字段列表”按钮，读取并查看当前 Jira 系统的所有字段定义</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
