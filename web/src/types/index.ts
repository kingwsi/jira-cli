export interface UserInfo {
  accountId?: string
  name: string
  displayName: string
  emailAddress?: string
  avatarUrl?: string
}

export interface ProgressReport {
  currentProgress?: number
  lastWeekProgress?: number
  progressStatus?: string
  productProgress?: number
  devProgress?: number
  testProgress?: number
  releaseProgress?: number
  deployProgress?: number
  techSolutionDesc?: string
  latestComment?: string
  category?: string
  demandType?: string
  clientName?: string
  productManager?: UserInfo
  isContractDemand?: string
  affectsDelivery?: string
}

export interface CommentItem {
  id: string
  author: UserInfo
  body: string
  created: string
  updated: string
}

export interface IssueItem {
  key: string
  id: string
  projectKey: string
  projectName?: string
  summary: string
  description?: string
  issueType: string
  status: string
  statusCategory?: string
  priority: string
  assignee?: UserInfo
  reporter?: UserInfo
  parentKey?: string
  parentSummary?: string
  startDate?: string
  endDate?: string
  originalEstimateSeconds: number
  remainingEstimateSeconds: number
  timeSpentSeconds: number
  createdAt: string
  updatedAt: string
  subtasks?: IssueItem[]
  customFields?: Record<string, any>
  progressReport?: ProgressReport
}

export interface PlanningTreeNode {
  key: string
  summary: string
  issueType: string
  status: string
  priority: string
  assignee?: UserInfo
  startDate: string
  endDate: string
  originalEstimateSeconds: number
  timeSpentSeconds: number
  progressPercent: number
  isParent: boolean
  children?: PlanningTreeNode[]
}

export interface TimelineTask {
  key: string
  summary: string
  issueType: string
  status: string
  priority: string
  parentKey?: string
  parentSummary?: string
  startDate: string
  endDate: string
  originalEstimateSeconds: number
  timeSpentSeconds: number
  progressPercent: number
  isOverdue: boolean
}

export interface SwimlaneMember {
  user: UserInfo
  totalTasks: number
  totalEstimateSeconds: number
  tasks: TimelineTask[]
  dailyWorkloads: Record<string, number>
}

export interface WorklogMatrixRow {
  issueKey: string
  issueSummary: string
  issueType: string
  assigneeName: string
  totalSpentSeconds: number
  dailySpentSeconds: Record<string, number>
}

export interface WorklogMatrixResponse {
  month: string
  daysInMonth: number
  totalSpentSeconds: number
  rows: WorklogMatrixRow[]
}

export interface WorklogWeekDay {
  date: string // YYYY-MM-DD
  weekday: number // 0=周日, 1=周一 ... 6=周六
  isToday: boolean
  isPast: boolean
}

export interface WorklogWeekResponse {
  weekStart: string // YYYY-MM-DD 周一
  weekEnd: string // YYYY-MM-DD 周日
  days: WorklogWeekDay[]
  totalSpentSeconds: number
  dailyTotalsSeconds: Record<string, number>
  rows: WorklogMatrixRow[]
}

export interface ServerConfig {
  url: string
  username: string
  isConfigured: boolean
  customFieldStartDate: string
  customFieldEndDate: string
  defaultProject: string
}

export interface Project {
  key: string
  name: string
}

export interface Transition {
  id: string
  name: string
  to: {
    name: string
  }
}
