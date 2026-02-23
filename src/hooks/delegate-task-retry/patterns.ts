export interface DelegateTaskErrorPattern {
  pattern: string
  errorType: string
  fixHint: string
}

export const DELEGATE_TASK_ERROR_PATTERNS: DelegateTaskErrorPattern[] = [
  {
    pattern: "Missing agent",
    errorType: "missing_agent",
    fixHint: "Provide agent or subagent_type",
  },
  {
    pattern: "Unsupported agent",
    errorType: "unsupported_agent",
    fixHint: "Use one of: researcher, scout, librarian, oracle",
  },
  {
    pattern: "Task not found",
    errorType: "unknown_task",
    fixHint: "Verify task_id and retry background_output/background_cancel",
  },
  {
    pattern: "Provide taskId or set all=true",
    errorType: "missing_cancel_target",
    fixHint: "Pass taskId or set all=true",
  },
]

export interface DetectedError {
  errorType: string
  originalOutput: string
}

export function detectDelegateTaskError(output: string): DetectedError | null {
  for (const pattern of DELEGATE_TASK_ERROR_PATTERNS) {
    if (output.includes(pattern.pattern)) {
      return {
        errorType: pattern.errorType,
        originalOutput: output,
      }
    }
  }
  return null
}
