import { tool, type ToolDefinition } from "@opencode-ai/plugin"

import { BackgroundManager } from "../../features/background-agent"
import type { BackgroundCancelArgs, BackgroundOutputArgs } from "./types"

export function createBackgroundOutputTool(manager: BackgroundManager): ToolDefinition {
  return tool({
    description: "Get status/result of a background task. Optionally wait until completion or fetch full session messages.",
    args: {
      task_id: tool.schema.string().describe("Background task ID"),
      block: tool.schema.boolean().optional().describe("Wait for completion before returning"),
      timeout: tool.schema.number().optional().describe("Timeout in milliseconds when block=true"),
      full_session: tool.schema.boolean().optional().describe("Return formatted full session transcript"),
      include_thinking: tool.schema.boolean().optional().describe("Include thinking/reasoning parts in full session mode"),
      include_tool_results: tool.schema.boolean().optional().describe("Include tool_result parts in full session mode"),
      message_limit: tool.schema.number().optional().describe("Limit number of session messages returned in full session mode"),
    },
    async execute(args: BackgroundOutputArgs) {
      const task = args.block
        ? await manager.waitFor(args.task_id, { timeoutMs: args.timeout })
        : manager.getTask(args.task_id)

      if (!task) {
        throw new Error(`Task not found: ${args.task_id}`)
      }

      if (args.full_session) {
        const session = await manager.getFormattedSession(args.task_id, {
          includeThinking: args.include_thinking === true,
          includeToolResults: args.include_tool_results === true,
          limit: args.message_limit,
        })
        return [
          `Task: ${task.id}`,
          `Status: ${task.status}`,
          `Session: ${task.sessionID ?? "(none)"}`,
          `Output file: ${task.outputFile ?? "(none)"}`,
          "",
          session,
        ].join("\n")
      }

      return [
        `Task: ${task.id}`,
        `Status: ${task.status}`,
        `Session: ${task.sessionID ?? "(none)"}`,
        `Output file: ${task.outputFile ?? "(none)"}`,
        `Started: ${task.startedAt?.toISOString() ?? "(none)"}`,
        `Completed: ${task.completedAt?.toISOString() ?? "(none)"}`,
        task.error ? `Error: ${task.error}` : "",
        "",
        task.result ?? "",
      ]
        .filter(Boolean)
        .join("\n")
    },
  })
}

export function createBackgroundCancelTool(manager: BackgroundManager): ToolDefinition {
  return tool({
    description: "Cancel a running/pending background task, or cancel all tasks.",
    args: {
      taskId: tool.schema.string().optional().describe("Task ID to cancel"),
      all: tool.schema.boolean().optional().describe("Cancel all running/pending tasks"),
    },
    async execute(args: BackgroundCancelArgs) {
      if (args.all) {
        const count = await manager.cancelAll()
        return `Cancelled ${count} task(s)`
      }
      if (!args.taskId) {
        throw new Error("Provide taskId or set all=true")
      }
      const ok = await manager.cancelTask(args.taskId)
      if (!ok) {
        throw new Error(`Task not found: ${args.taskId}`)
      }
      return `Cancelled task ${args.taskId}`
    },
  })
}
