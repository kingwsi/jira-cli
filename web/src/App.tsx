import React, { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Header } from './components/Header'
import { TaskDrawer } from './components/TaskDrawer'
import { PlanningPage } from './pages/PlanningPage'
import { TasksPage } from './pages/TasksPage'
import { BugsPage } from './pages/BugsPage'
import { WorklogsPage } from './pages/WorklogsPage'
import { SettingsPage } from './pages/SettingsPage'

export const App: React.FC = () => {
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null)

  return (
    <div data-ui="admin-shell">
      <Header
        onSelectIssue={(key) => setSelectedIssueKey(key)}
      />
      <main data-ui="admin-main">
        <Routes>
          <Route path="/" element={<Navigate to="/planning" replace />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/bugs" element={<BugsPage />} />
          <Route path="/worklogs" element={<WorklogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      {/* 全局搜索或触发详情抽屉 */}
      <TaskDrawer
        issueKey={selectedIssueKey}
        onClose={() => setSelectedIssueKey(null)}
      />
    </div>
  )
}
export default App
