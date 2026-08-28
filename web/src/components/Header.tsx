import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  CalendarRange,
  CheckSquare,
  Clock,
  Settings,
  Layers,
  Search,
  User,
} from 'lucide-react'
import { api } from '../api/client'

interface HeaderProps {
  onSelectIssue?: (key: string) => void
}

export const Header: React.FC<HeaderProps> = ({ onSelectIssue }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    api.getCurrentUser().then(setCurrentUser).catch(() => {})
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim() && onSelectIssue) {
      onSelectIssue(searchQuery.trim().toUpperCase())
    }
  }

  return (
    <header data-ui="top-nav">
      {/* 左侧：Logo 与 主导航菜单 */}
      <div data-ui="top-nav-left">
        <NavLink to="/tasks" data-ui="top-nav-brand">
          <div data-ui="top-nav-logo">
            <Layers size={16} />
          </div>
          <span data-ui="top-nav-title">Jira Workbench</span>
        </NavLink>

        <nav data-ui="top-nav-links">
          <NavLink
            to="/tasks"
            data-ui="top-nav-item"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <CheckSquare size={15} />
            <span>待办</span>
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

          <NavLink
            to="/settings"
            data-ui="top-nav-item"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <Settings size={15} />
            <span>系统设置</span>
          </NavLink>
        </nav>
      </div>

      {/* 右侧：全局搜索与用户信息 */}
      <div data-ui="top-nav-right">
        <div data-ui="search-input" style={{ width: '260px' }}>
          <Search size={14} />
          <input
            data-ui="input"
            placeholder="搜索任务 Key (如 DSYFB-123)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              height: '32px',
              fontSize: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderColor: 'rgba(255, 255, 255, 0.25)',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            color: '#ffffff',
          }}
        >
          <User size={13} />
          <span>{currentUser?.displayName || currentUser?.name || '已连接'}</span>
        </div>
      </div>
    </header>
  )
}

