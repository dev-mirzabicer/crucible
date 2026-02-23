import { z } from "zod"

export const HookNameSchema = z.enum([
  "context-window-monitor",
  "session-recovery",
  "session-notification",
  "comment-checker",
  "grep-output-truncator",
  "tool-output-truncator",
  "question-label-truncator",
  "directory-agents-injector",
  "directory-readme-injector",
  "empty-task-response-detector",
  "think-mode",
  "anthropic-context-window-limit-recovery",
  "preemptive-compaction",
  "rules-injector",
  "background-notification",
  "startup-toast",
  "keyword-detector",
  "agent-usage-reminder",
  "non-interactive-env",
  "interactive-bash-session",

  "thinking-block-validator",
  "category-skill-reminder",

  "compaction-context-injector",
  "compaction-todo-preserver",
  "auto-slash-command",
  "edit-error-recovery",
  "json-error-recovery",
  "delegate-task-retry",
  "task-reminder",
  "task-resume-info",
  "tasks-todowrite-disabler",
  "write-existing-file-guard",
  "anthropic-effort",
  "hashline-read-enhancer",
  "hashline-edit-diff-enhancer",
])

export type HookName = z.infer<typeof HookNameSchema>
