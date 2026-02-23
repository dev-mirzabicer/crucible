export type BackgroundTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export interface BackgroundTaskModel {
  providerID: string
  modelID: string
  variant?: string
}

export interface BackgroundTask {
  id: string
  description: string
  prompt: string
  agent: string
  parentSessionID: string
  parentMessageID: string
  parentAgent?: string
  sessionID?: string
  model?: BackgroundTaskModel
  status: BackgroundTaskStatus
  queuedAt: Date
  startedAt?: Date
  completedAt?: Date
  result?: string
  error?: string
  outputFile?: string
  lastMessageCount?: number
  stablePolls?: number
  idleSeen?: boolean
  lastActivityAt: Date
  runInBackground: boolean
  slotAcquired?: boolean
}

export interface BackgroundTaskContextOptions {
  includePlanContext?: boolean
  includePersistMessages?: boolean
  recentToolCalls?: number
  specificToolCallIDs?: string[]
  files?: string[]
}

export interface LaunchTaskInput {
  description: string
  prompt: string
  agent: string
  parentSessionID: string
  parentMessageID: string
  parentAgent?: string
  model?: BackgroundTaskModel
  runInBackground: boolean
}

export interface ContinueTaskInput {
  sessionID: string
  prompt: string
  parentSessionID: string
  parentMessageID: string
  parentAgent?: string
  model?: BackgroundTaskModel
  runInBackground: boolean
  description: string
  agent: string
}

export interface BackgroundTaskConfig {
  defaultConcurrency: number
  modelConcurrency: Record<string, number>
  pollIntervalMs: number
  staleTimeoutMs: number
  stablePollThreshold: number
  quietPeriodMs: number
  defaultWaitTimeoutMs: number
  minimumRuntimeMs: number
}

export interface WaitOptions {
  timeoutMs?: number
}
