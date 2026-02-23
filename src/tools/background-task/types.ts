export interface BackgroundOutputArgs {
  task_id: string
  block?: boolean
  timeout?: number
  full_session?: boolean
  include_thinking?: boolean
  include_tool_results?: boolean
  message_limit?: number
}

export interface BackgroundCancelArgs {
  taskId?: string
  all?: boolean
}
