import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  CalendarRange,
  CheckSquare,
  Clock,
  Settings,
  User,
  FileText,
} from 'lucide-react'
import { api } from '../api/client'

export const Header: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    api.getCurrentUser().then(setCurrentUser).catch(() => {})
  }, [])

  return (
    <header data-ui="top-nav">
      {/* 左侧：品牌标题与主导航菜单 */}
      <div data-ui="top-nav-left">
        <NavLink to="/tasks" data-ui="top-nav-brand">
          <span data-ui="top-nav-title">Jira Workbench</span>
        </NavLink>

        <nav data-ui="top-nav-links" aria-label="主导航">
          <NavLink
            to="/tasks"
            data-ui="top-nav-item"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <CheckSquare size={15} />
            <span>待办</span>
          </NavLink>

          <NavLink
            to="/requirements"
            data-ui="top-nav-item"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <FileText size={15} />
            <span>需求</span>
          </NavLink>

          <NavLink
            to="/planning"
            data-ui="top-nav-item"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <CalendarRange size={15} />
            <span>规划与排期</span>
          </NavLink>

          <NavLink
            to="/worklogs"
            data-ui="top-nav-item"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <Clock size={15} />
            <span>工时填报</span>
          </NavLink>

        </nav>
      </div>

      {/* 右侧：连接用户与系统设置 */}
      <div data-ui="top-nav-right">
        <div
          data-ui="current-user"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: '#deebff',
            userSelect: 'none',
          }}
        >
          <User size={14} style={{ opacity: 0.8 }} />
          <span>{currentUser?.displayName || currentUser?.name || '已连接'}</span>
        </div>

        <NavLink
          to="/settings"
          data-ui="top-nav-settings"
          className={({ isActive }) => (isActive ? 'active' : '')}
          aria-label="系统设置"
          title="系统设置"
        >
          <Settings size={17} />
        </NavLink>
      </div>
    </header>
  )
}
