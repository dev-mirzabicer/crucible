import { tool, type PluginInput, type ToolDefinition } from "@opencode-ai/plugin"

import { BackgroundManager, type BackgroundTaskModel } from "../../features/background-agent"
import { log } from "../../shared"
import { buildDelegationPrompt } from "./context-builder"
import type { TaskArgs } from "./types"

const ALLOWED_SUBAGENTS = new Set(["researcher", "scout", "librarian", "oracle", "artistry"])

function normalizeAgent(args: TaskArgs): string {
  const raw = (args.agent ?? args.subagent_type ?? "").trim().toLowerCase()
  if (!raw) {
    throw new Error("Missing agent. Provide agent or subagent_type")
  }
  if (!ALLOWED_SUBAGENTS.has(raw)) {
    throw new Error(`Unsupported agent: ${raw}. Allowed: ${[...ALLOWED_SUBAGENTS].join(", ")}`)
  }
  return raw
}

function normalizeModel(model: unknown): BackgroundTaskModel | undefined {
  if (!model || typeof model !== "object") return undefined
  const value = model as Record<string, unknown>
  if (typeof value.providerID !== "string" || typeof value.modelID !== "string") return undefined
  return {
    providerID: value.providerID,
    modelID: value.modelID,
    variant: typeof value.variant === "string" ? value.variant : undefined,
  }
}

function retryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  const value = message.toLowerCase()
  return (
    value.includes("timed out") ||
    value.includes("timeout") ||
    value.includes("rate limit") ||
    value.includes("context limit") ||
    value.includes("network") ||
    value.includes("temporar")
  )
}

async function withRetry<T>(action: () => Promise<T>): Promise<T> {
  let last: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await action()
    } catch (error) {
      last = error
      if (!retryableError(error) || attempt === 1) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw (last instanceof Error ? last : new Error(String(last)))
}

export function createTaskTool(ctx: PluginInput, manager: BackgroundManager): ToolDefinition {
  return tool({
    description:
      "Delegate work to a specific sub-agent. Blocking by default. Supports fresh_context and structured context injection.",
    args: {
      description: tool.schema.string().describe("Short task description"),
      prompt: tool.schema.string().describe("Detailed task prompt"),
      agent: tool.schema.string().optional().describe("Target sub-agent (researcher|scout|librarian|oracle|artistry)"),
      subagent_type: tool.schema.string().optional().describe("Alias of agent"),
      fresh_context: tool.schema.boolean().optional().describe("If true, do not inject parent plan/persist/tool context"),
      context: tool.schema
        .object({
          includePlanContext: tool.schema.boolean().optional(),
          includePersistMessages: tool.schema.boolean().optional(),
          recentToolCalls: tool.schema.number().optional(),
          specificToolCallIDs: tool.schema.array(tool.schema.string()).optional(),
          files: tool.schema.array(tool.schema.string()).optional(),
        })
        .optional(),
      run_in_background: tool.schema.boolean().optional().describe("Default false (blocking)"),
      session_id: tool.schema.string().optional().describe("Continue an existing sub-agent session"),
      model: tool.schema
        .object({
          providerID: tool.schema.string(),
          modelID: tool.schema.string(),
          variant: tool.schema.string().optional(),
        })
        .optional(),
    },
    async execute(args: TaskArgs, toolCtx?: { sessionID?: string; messageID?: string; agent?: string; metadata?: (input: { title?: string; metadata?: Record<string, unknown> }) => void }) {
      const parentSessionID = toolCtx?.sessionID
      if (!parentSessionID) {
        throw new Error("Task tool requires a parent session context")
      }

      const agent = normalizeAgent(args)
      const runInBackground = args.run_in_background === true
      const freshContext = args.fresh_context === true
      const prompt = await buildDelegationPrompt({
        ctx,
        parentSessionID,
        prompt: args.prompt,
        freshContext,
        options: args.context ?? {},
      })

      const parentMessageID = toolCtx?.messageID ?? ""
      const parentAgent = toolCtx?.agent
      const model = normalizeModel(args.model)

      toolCtx?.metadata?.({ title: args.description })

      if (args.session_id) {
        const continuedSessionID = args.session_id
        const task = await withRetry(() => manager.continueSession({
          sessionID: continuedSessionID,
          prompt,
          parentSessionID,
          parentMessageID,
          parentAgent,
          model,
          runInBackground,
          description: args.description,
          agent,
        }))

        if (runInBackground) {
          return `Background task resumed. task_id=${task.id} session_id=${task.sessionID}`
        }

        const completed = await manager.waitFor(task.id)
        if (completed.status === "failed") {
          throw new Error(completed.error ?? "Delegated task failed")
        }
        return [
          `Task completed: ${completed.id}`,
          `Session: ${completed.sessionID ?? "(none)"}`,
          `Output file: ${completed.outputFile ?? "(none)"}`,
          "",
          completed.result ?? "",
        ].join("\n")
      }

      const task = await withRetry(() => manager.launch({
        description: args.description,
        prompt,
        agent,
        parentSessionID,
        parentMessageID,
        parentAgent,
        model,
        runInBackground,
      }))

      log("[task] launched", {
        taskID: task.id,
        sessionID: task.sessionID,
        runInBackground,
      })

      if (runInBackground) {
        return `Background task started. task_id=${task.id}`
      }

      const completed = await manager.waitFor(task.id)
      if (completed.status === "failed") {
        throw new Error(completed.error ?? "Delegated task failed")
      }
      if (completed.status === "cancelled") {
        throw new Error("Delegated task was cancelled")
      }

      return [
        `Task completed: ${completed.id}`,
        `Session: ${completed.sessionID ?? "(none)"}`,
        `Output file: ${completed.outputFile ?? "(none)"}`,
        "",
        completed.result ?? "",
      ].join("\n")
    },
  })
}
