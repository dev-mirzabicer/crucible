import { tool, type PluginInput, type ToolDefinition } from "@opencode-ai/plugin"

import { BackgroundManager } from "../../features/background-agent"
import { buildDelegationPrompt } from "../task/context-builder"
import type { AgentInvokeArgs } from "./types"

function normalizeModel(model: unknown) {
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

export function createAgentInvokeTool(ctx: PluginInput, manager: BackgroundManager): ToolDefinition {
  return tool({
    description: "Invoke a specific agent directly by name (no category abstraction).",
    args: {
      description: tool.schema.string().describe("Short task description"),
      prompt: tool.schema.string().describe("Detailed task prompt"),
      subagent_type: tool.schema.string().describe("Target sub-agent name"),
      run_in_background: tool.schema.boolean().optional().describe("Default false (blocking)"),
      session_id: tool.schema.string().optional().describe("Continue an existing sub-agent session"),
      fresh_context: tool.schema.boolean().optional().describe("If true, run with fresh context"),
      context: tool.schema
        .object({
          includePlanContext: tool.schema.boolean().optional(),
          includePersistMessages: tool.schema.boolean().optional(),
          recentToolCalls: tool.schema.number().optional(),
          specificToolCallIDs: tool.schema.array(tool.schema.string()).optional(),
        })
        .optional(),
      model: tool.schema
        .object({
          providerID: tool.schema.string(),
          modelID: tool.schema.string(),
          variant: tool.schema.string().optional(),
        })
        .optional(),
    },
    async execute(args: AgentInvokeArgs, toolCtx) {
      const parentSessionID = toolCtx?.sessionID
      if (!parentSessionID) {
        throw new Error("agent_invoke requires a parent session context")
      }

      const runInBackground = args.run_in_background === true
      const freshContext = args.fresh_context === true
      const prompt = await buildDelegationPrompt({
        ctx,
        parentSessionID,
        prompt: args.prompt,
        freshContext,
        options: args.context ?? {},
      })

      const model = normalizeModel(args.model)

      if (args.session_id) {
        const continuedSessionID = args.session_id
        const resumed = await withRetry(() => manager.continueSession({
          sessionID: continuedSessionID,
          prompt,
          parentSessionID,
          parentMessageID: toolCtx?.messageID ?? "",
          parentAgent: toolCtx?.agent,
          model,
          runInBackground,
          description: args.description,
          agent: args.subagent_type,
        }))
        if (runInBackground) {
          return `Background agent session resumed. task_id=${resumed.id} session_id=${resumed.sessionID}`
        }
        const completed = await manager.waitFor(resumed.id)
        if (completed.status === "failed") {
          throw new Error(completed.error ?? "Agent invocation failed")
        }
        return [
          `Agent invocation completed: ${completed.id}`,
          `Session: ${completed.sessionID ?? "(none)"}`,
          `Output file: ${completed.outputFile ?? "(none)"}`,
          "",
          completed.result ?? "",
        ].join("\n")
      }

      const task = await withRetry(() => manager.launch({
        description: args.description,
        prompt,
        agent: args.subagent_type,
        parentSessionID,
        parentMessageID: toolCtx?.messageID ?? "",
        parentAgent: toolCtx?.agent,
        model,
        runInBackground,
      }))

      if (runInBackground) {
        return `Background agent invocation started. task_id=${task.id}`
      }

      const completed = await manager.waitFor(task.id)
      if (completed.status === "failed") {
        throw new Error(completed.error ?? "Agent invocation failed")
      }
      return [
        `Agent invocation completed: ${completed.id}`,
        `Session: ${completed.sessionID ?? "(none)"}`,
        `Output file: ${completed.outputFile ?? "(none)"}`,
        "",
        completed.result ?? "",
      ].join("\n")
    },
  })
}
