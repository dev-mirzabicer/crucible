/** Absolute max lifetime for any task — kills regardless of activity */
export const TASK_TTL_MS = 60 * 60 * 1000 // 60 minutes

/** Stale timeout for sessions that had progress but went idle */
export const DEFAULT_STALE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

/** Stale timeout for sessions that NEVER had any progress */
export const DEFAULT_MESSAGE_STALENESS_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes

/** Minimum runtime before any stale check applies */
export const MIN_RUNTIME_BEFORE_STALE_MS = 30 * 1000 // 30 seconds

/** How many consecutive polls with unknown status before considering task stuck */
export const MAX_UNKNOWN_STATUS_POLLS = 40 // 40 × 1.5s = 60 seconds

export const DEFAULT_BACKGROUND_TASK_CONFIG = {
  defaultConcurrency: 5,
  modelConcurrency: {} as Record<string, number>,
  pollIntervalMs: 1500,
  staleTimeoutMs: DEFAULT_STALE_TIMEOUT_MS,
  messageStalenessTimeoutMs: DEFAULT_MESSAGE_STALENESS_TIMEOUT_MS,
  minRuntimeBeforeStaleMs: MIN_RUNTIME_BEFORE_STALE_MS,
  taskTtlMs: TASK_TTL_MS,
  maxUnknownStatusPolls: MAX_UNKNOWN_STATUS_POLLS,
  stablePollThreshold: 3,
  quietPeriodMs: 4_000,
  defaultWaitTimeoutMs: 30 * 60 * 1000, // 30 minutes
  minimumRuntimeMs: 8_000,
} as const

export const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"])
