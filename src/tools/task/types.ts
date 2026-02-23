import type { BackgroundTaskContextOptions, BackgroundTaskModel } from "../../features/background-agent"

export interface TaskArgs {
  description: string
  prompt: string
  subagent_type: string
  fresh_context?: boolean
  context?: BackgroundTaskContextOptions
  run_in_background?: boolean
  session_id?: string
  model?: BackgroundTaskModel
}
