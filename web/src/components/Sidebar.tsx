import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  CalendarRange,
  CheckSquare,
  Bug,
  Clock,
  Settings,
  Layers,
} from 'lucide-react'

export const Sidebar: React.FC = () => {
  return (
    <aside data-ui="sidebar">
      <div data-ui="sidebar-header">
        <div data-ui="sidebar-logo">
          <Layers size={18} />
        </div>
        <div>
          <div data-ui="sidebar-title">Jira Workbench</div>
          <div data-ui="sidebar-subtitle">任务规划与排期工作台</div>
        </div>
      </div>

      <nav data-ui="sidebar-nav">
        <NavLink
          to="/planning"
          data-ui="nav-item"
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          <CalendarRange size={16} />
          <span>规划与排期</span>
        </NavLink>

        <NavLink
          to="/tasks"
          data-ui="nav-item"
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          <CheckSquare size={16} />
          <span>我的任务</span>
        </NavLink>

        <NavLink
          to="/bugs"
          data-ui="nav-item"
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          <Bug size={16} />
          <span>缺陷中心</span>
        </NavLink>

        <NavLink
          to="/worklogs"
          data-ui="nav-item"
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          <Clock size={16} />
          <span>工时填报</span>
        </NavLink>

        <NavLink
          to="/settings"
          data-ui="nav-item"
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          <Settings size={16} />
          <span>系统设置</span>
        </NavLink>
      </nav>

      <div data-ui="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#36b37e',
            }}
          />
          <span style={{ fontSize: '11px', color: '#deebff' }}>已连接 Jira</span>
        </div>
      </div>
    </aside>
  )
}
