export type WorkflowMode = "phase" | "general"

export interface PersistEntry {
  userMessageID?: string
  userText: string
  assistantText?: string
  createdAt: string
}

export interface SessionWorkflowState {
  sessionID: string
  firstMessageSeen: boolean
  needsPlanReinject: boolean
  pendingPlanInjection: boolean
  loadedPlanFiles: string[]
  modifiedFiles: string[]
  keyDecisions: string[]
  persistEntries: PersistEntry[]
  pendingPersistResponses: number
  currentPhase?: number
  currentSubphase?: string
}

export interface ProjectWorkflowState {
  projectDir: string
  mode: WorkflowMode
  currentPhase?: number
  currentSubphase?: string
  sessions: Record<string, SessionWorkflowState>
}

export interface ParsedPosition {
  phase?: number
  subphase?: string
}
