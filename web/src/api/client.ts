import {
  IssueItem,
  PlanningTreeNode,
  SwimlaneMember,
  WorklogMatrixResponse,
  WorklogWeekResponse,
  ServerConfig,
  Project,
  Transition,
  CommentItem,
} from '../types'

const BASE_URL = '/api/v1'
const inFlightGetRequests = new Map<string, Promise<unknown>>()

function request<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase()
  const requestKey = `${method}:${url}`
  if (method === 'GET') {
    const pending = inFlightGetRequests.get(requestKey)
    if (pending) return pending as Promise<T>
  }

  const pending = (async () => {
    const res = await fetch(`${BASE_URL}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    })

    const json = await res.json()
    if (!res.ok || json.code !== 0) {
      throw new Error(json.message || `请求失败 (${res.status})`)
    }
    return json.data as T
  })()

  if (method === 'GET') {
    inFlightGetRequests.set(requestKey, pending)
    pending.finally(() => {
      if (inFlightGetRequests.get(requestKey) === pending) {
        inFlightGetRequests.delete(requestKey)
      }
    }).catch(() => {})
  }

  return pending
}

let configRequest: Promise<ServerConfig> | null = null
let currentUserRequest: Promise<any> | null = null

function getConfig() {
  if (!configRequest) {
    configRequest = request<ServerConfig>('/config').catch((error) => {
      configRequest = null
      throw error
    })
  }
  return configRequest
}

function getCurrentUser() {
  if (!currentUserRequest) {
    currentUserRequest = request<any>('/users/me').catch((error) => {
      currentUserRequest = null
      throw error
    })
  }
  return currentUserRequest
}

async function saveConfig(body: { url: string; username: string; password?: string }) {
  await request<void>('/config', { method: 'POST', body: JSON.stringify(body) })
  configRequest = null
  currentUserRequest = null
}

export const api = {
  // Config
  getConfig,
  saveConfig,
  testConnection: (body: { url: string; username: string; password?: string }) =>
    request<any>('/config/test', { method: 'POST', body: JSON.stringify(body) }),
  getFields: () => request<any[]>('/jira/fields'),

  // Projects & Users
  getProjects: () => request<Project[]>('/projects'),
  getCurrentUser,
  searchUsers: (query?: string) =>
    request<any[]>(`/users/search${query ? `?query=${encodeURIComponent(query)}` : ''}`),

  // Issues
  getIssues: (params?: {
    type?: string
    status?: string
    assignee?: string
    project?: string
    jql?: string
    month?: string
    summary?: string
  }) => {
    const searchParams = new URLSearchParams()
    if (params?.type) searchParams.set('type', params.type)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.assignee) searchParams.set('assignee', params.assignee)
    if (params?.project) searchParams.set('project', params.project)
    if (params?.jql) searchParams.set('jql', params.jql)
    if (params?.month) searchParams.set('month', params.month)
    if (params?.summary) searchParams.set('summary', params.summary)
    const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return request<IssueItem[]>(`/issues${query}`)
  },
  getIssue: (key: string) => request<IssueItem>(`/issues/${key}`),
  createIssue: (body: {
    project: string
    summary: string
    issueType: string
    description?: string
    parentKey?: string
    startDate?: string
    endDate?: string
  }) => request<IssueItem>('/issues', { method: 'POST', body: JSON.stringify(body) }),
  updateIssue: (key: string, body: { summary?: string; description?: string; startDate?: string; endDate?: string; assignee?: string; originalEstimate?: string }) =>
    request<void>(`/issues/${key}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getTransitions: (key: string) => request<Transition[]>(`/issues/${key}/transitions`),
  doTransition: (params: {
    key: string
    transitionId?: string
    action?: 'resolve' | 'reject'
    assignee?: string
    comment?: string
    timeSpent?: string
    workDate?: string
    autoChain?: boolean
  }) =>
    request<void>(`/issues/${params.key}/transitions`, {
      method: 'POST',
      body: JSON.stringify({
        transitionId: params.transitionId || params.action || 'auto',
        action: params.action || 'resolve',
        assignee: params.assignee || undefined,
        comment: params.comment ? params.comment.trim() : undefined,
        timeSpent: params.timeSpent ? params.timeSpent.trim() : undefined,
        workDate: params.workDate ? params.workDate.trim() : undefined,
        autoChain: params.autoChain ?? true,
      }),
    }),
  getComments: (key: string) => request<CommentItem[]>(`/issues/${key}/comments`),
  addComment: (key: string, comment: string) =>
    request<void>(`/issues/${key}/comments`, { method: 'POST', body: JSON.stringify({ comment }) }),
  updateWeeklyProgress: (
    key: string,
    body: {
      currentProgress?: number
      lastWeekProgress?: number
      progressStatus?: string
      productProgress?: number
      devProgress?: number
      testProgress?: number
      releaseProgress?: number
      deployProgress?: number
      comment?: string
    }
  ) => request<void>(`/issues/${key}/progress`, { method: 'POST', body: JSON.stringify(body) }),

  // Planning
  getPlanningTree: (params?: { month?: string; project?: string; assignee?: string; includeSiblings?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.month) searchParams.set('month', params.month)
    if (params?.project) searchParams.set('project', params.project)
    if (params?.assignee) searchParams.set('assignee', params.assignee)
    if (params?.includeSiblings !== undefined) searchParams.set('includeSiblings', String(params.includeSiblings))
    const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return request<PlanningTreeNode[]>(`/planning/tree${query}`)
  },
  getTeamSwimlanes: (params?: { month?: string; project?: string; assignee?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.month) searchParams.set('month', params.month)
    if (params?.project) searchParams.set('project', params.project)
    if (params?.assignee) searchParams.set('assignee', params.assignee)
    const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return request<SwimlaneMember[]>(`/planning/team${query}`)
  },
  batchUpdateSchedule: (updates: { key: string; startDate?: string; endDate?: string; estimate?: string }[]) =>
    request<void>('/planning/batch', { method: 'POST', body: JSON.stringify({ updates }) }),

  // Worklogs
  getWorklogMatrix: (month?: string, author?: string) => {
    const searchParams = new URLSearchParams()
    if (month) searchParams.set('month', month)
    if (author) searchParams.set('author', author)
    const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return request<WorklogMatrixResponse>(`/worklogs/matrix${query}`)
  },
  getWorklogWeek: (start?: string, author?: string) => {
    const searchParams = new URLSearchParams()
    if (start) searchParams.set('start', start)
    if (author) searchParams.set('author', author)
    const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return request<WorklogWeekResponse>(`/worklogs/week${query}`)
  },
  addWorklog: (body: { issueKey: string; timeSpent: string; started?: string; comment?: string }) =>
    request<void>('/worklogs', { method: 'POST', body: JSON.stringify(body) }),
}
