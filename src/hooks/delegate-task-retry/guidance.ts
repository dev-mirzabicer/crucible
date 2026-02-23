import { DELEGATE_TASK_ERROR_PATTERNS, type DetectedError } from "./patterns"

export function buildRetryGuidance(errorInfo: DetectedError): string {
  const pattern = DELEGATE_TASK_ERROR_PATTERNS.find((item) => item.errorType === errorInfo.errorType)
  if (!pattern) {
    return "\n[task retry] Fix parameters and retry."
  }

  return [
    "",
    "[task CALL FAILED - RETRY WITH FIXED PARAMETERS]",
    `Error Type: ${errorInfo.errorType}`,
    `Fix: ${pattern.fixHint}`,
    "",
    "Example:",
    "task(description=\"...\", prompt=\"...\", agent=\"scout\", run_in_background=false)",
    "",
  ].join("\n")
}
