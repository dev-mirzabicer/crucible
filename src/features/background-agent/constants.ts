export const DEFAULT_BACKGROUND_TASK_CONFIG = {
  defaultConcurrency: 5,
  modelConcurrency: {},
  pollIntervalMs: 1500,
  staleTimeoutMs: 10 * 60 * 1000,
  stablePollThreshold: 3,
  quietPeriodMs: 4_000,
  defaultWaitTimeoutMs: 12 * 60 * 1000,
  minimumRuntimeMs: 8_000,
} as const

export const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"])
