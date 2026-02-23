import type { BackgroundTaskContextOptions, BackgroundTaskModel } from "../../features/background-agent"

export interface AgentInvokeArgs {
  description: string
  prompt: string
  subagent_type: string
  run_in_background?: boolean
  session_id?: string
  fresh_context?: boolean
  context?: BackgroundTaskContextOptions
  model?: BackgroundTaskModel
}
