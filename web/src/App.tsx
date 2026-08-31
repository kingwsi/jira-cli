import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Header } from './components/Header'
import { PlanningPage } from './pages/PlanningPage'
import { TasksPage } from './pages/TasksPage'
import { BugsPage } from './pages/BugsPage'
import { RequirementsPage } from './pages/RequirementsPage'
import { WorklogsPage } from './pages/WorklogsPage'
import { SettingsPage } from './pages/SettingsPage'
import { api } from './api/client'
import { requestUpdates, type UpdateStatus } from './api/updates'
import { ServerConfig } from './types'

export const App: React.FC = () => {
  const [update, setUpdate] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const next = await requestUpdates()
        if (active) setUpdate(next)
      } catch { /* A failed status request must not interrupt navigation. */ }
    }
    void refresh()
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('updates-changed', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('updates-changed', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])


  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setError('')
    api.getConfig().then((value) => {
      if (active) setConfig(value)
    }).catch((err: Error) => {
      if (active) setError(err.message)
    })
    return () => { active = false }
  }, [attempt])

  if (!config) {
    return (
      <div data-ui="page-content" role={error ? 'alert' : 'status'}>
        <p>{error ? `无法读取 Jira 配置：${error}` : '正在检查 Jira 连接配置…'}</p>
        {error && <button data-ui="button" onClick={() => setAttempt((value) => value + 1)}>重试</button>}
      </div>
    )
  }

  const setupRequired = !config.isConfigured
  const settings = <SettingsPage setupRequired={setupRequired} onConfigured={setConfig} update={update} />

  return (
    <div data-ui="admin-shell">
      <Header configured={config.isConfigured} update={update} />
      <main data-ui="admin-main">
        {setupRequired ? (
          <Routes>
            <Route path="/settings" element={settings} />
            <Route path="*" element={<Navigate to="/settings" replace />} />
          </Routes>
        ) : <Routes>
          <Route path="/" element={<Navigate to="/tasks" replace />} />
          <Route path="/todo" element={<Navigate to="/tasks" replace />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/requirements" element={<RequirementsPage />} />
          <Route path="/bugs" element={<BugsPage />} />
          <Route path="/worklogs" element={<WorklogsPage />} />
          <Route path="/settings" element={settings} />
        </Routes>}
      </main>

    </div>
  )
}
export default App
