import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Header } from './components/Header'
import { PlanningPage } from './pages/PlanningPage'
import { TasksPage } from './pages/TasksPage'
import { BugsPage } from './pages/BugsPage'
import { RequirementsPage } from './pages/RequirementsPage'
import { WorklogsPage } from './pages/WorklogsPage'
import { SettingsPage } from './pages/SettingsPage'

export const App: React.FC = () => {
  return (
    <div data-ui="admin-shell">
      <Header />
      <main data-ui="admin-main">
        <Routes>
          <Route path="/" element={<Navigate to="/tasks" replace />} />
          <Route path="/todo" element={<Navigate to="/tasks" replace />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/requirements" element={<RequirementsPage />} />
          <Route path="/bugs" element={<BugsPage />} />
          <Route path="/worklogs" element={<WorklogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

    </div>
  )
}
export default App
