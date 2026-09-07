import { api } from '../api/client'

export interface UserHistoryItem {
  name: string
  displayName: string
  count: number
  lastUsed: number
}

// 纯前端内存响应式缓存（数据源自后端 SQLite 数据库）
let memoryCache: UserHistoryItem[] = []
let isInitialized = false
const listeners: Array<(items: UserHistoryItem[]) => void> = []

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn(memoryCache)
    } catch {}
  })
}

/**
 * 从后端 SQLite 数据库拉取最新的常用成员历史（按选择频次排序）
 */
export async function loadFrequentUsers(limit = 10): Promise<UserHistoryItem[]> {
  try {
    const list = await api.getUserHistory(limit)
    if (Array.isArray(list)) {
      memoryCache = list
      isInitialized = true
      notifyListeners()
      return memoryCache
    }
  } catch (err) {
    console.error('从后端 SQLite 数据库加载成员历史失败:', err)
  }
  return memoryCache
}

/**
 * 同步获取当前内存中的常用成员（已按频次排序）
 */
export function getFrequentUsers(limit = 8): UserHistoryItem[] {
  if (!isInitialized) {
    loadFrequentUsers(limit)
  }
  return memoryCache.slice(0, limit)
}

/**
 * 记录用户选择：
 * 1. 本地内存乐观更新，界面零延迟响应
 * 2. 持久化存储至后端本地 SQLite 数据库 (jira_workbench.db)
 */
export async function recordUserSelection(user: { name: string; displayName?: string }): Promise<void> {
  if (!user || !user.name) return

  const displayName = user.displayName || user.name
  const now = Date.now()

  // 1. 内存乐观更新
  const index = memoryCache.findIndex((u) => u.name === user.name)
  if (index >= 0) {
    memoryCache[index].count += 1
    memoryCache[index].lastUsed = now
    if (displayName) memoryCache[index].displayName = displayName
  } else {
    memoryCache.push({
      name: user.name,
      displayName,
      count: 1,
      lastUsed: now,
    })
  }

  // 按选择次数倒序与最近使用排序
  memoryCache.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return b.lastUsed - a.lastUsed
  })
  notifyListeners()

  // 2. 调用接口持久化入后端 SQLite 数据库
  try {
    await api.recordUserHistory({ name: user.name, displayName })
  } catch (err) {
    console.error('向后端 SQLite 数据库保存成员选择失败:', err)
  }
}

/**
 * 订阅用户历史变化
 */
export function subscribeUserHistory(callback: (items: UserHistoryItem[]) => void): () => void {
  listeners.push(callback)
  if (memoryCache.length > 0) {
    callback(memoryCache)
  }
  return () => {
    const idx = listeners.indexOf(callback)
    if (idx >= 0) listeners.splice(idx, 1)
  }
}

// 模块加载时预拉取后端 SQLite 数据库
if (typeof window !== 'undefined') {
  loadFrequentUsers(10)
}
