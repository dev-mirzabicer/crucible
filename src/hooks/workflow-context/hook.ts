import type { PluginInput } from "@opencode-ai/plugin"
import { mkdirSync } from "node:fs"
import { join } from "node:path"

import type { BackgroundManager } from "../../features/background-agent"
import type { WorkflowStateManager } from "../../features/workflow-state"
import type { createCompactionTodoPreserverHook } from "../compaction-todo-preserver"
import { log } from "../../shared"
import { buildPlanContext } from "./plan-context"
import {
  extractFilePathFromToolOutput,
  extractLatestAssistantText,
  getFirstTextPart,
  prependToFirstText,
} from "./message-utils"

type TodoPreserver = ReturnType<typeof createCompactionTodoPreserverHook>

function parsePhaseArgument(argument: string): { phase?: number; subphase?: string } {
  const trimmed = argument.trim()
  const sub = trimmed.match(/(\d+)[.-](\d+)/)
  if (sub) {
    const phase = Number(sub[1])
    const part = Number(sub[2])
    if (Number.isFinite(phase) && Number.isFinite(part)) {
      return { phase, subphase: `${phase}-${part}` }
    }
  }
  const phaseOnly = trimmed.match(/(\d+)/)
  if (phaseOnly) {
    const phase = Number(phaseOnly[1])
    if (Number.isFinite(phase)) {
      return { phase }
    }
  }
  return {}
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true })
}

function compactionContext(input: {
  state: ReturnType<WorkflowStateManager["getCompactionState"]>
  backgroundSessions: string[]
  todos: Array<{ content: string; status: string; priority?: string }>
}): string {
  const preserved =
    input.state.persistEntries.length > 0
      ? input.state.persistEntries
          .map(
            (entry, index) => [
              `<message index="${index + 1}">`,
              `<user>${entry.userText}</user>`,
              `<assistant>${entry.assistantText ?? ""}</assistant>`,
              "</message>",
            ].join("\n"),
          )
          .join("\n")
      : "<none/>"

  const todoBlock =
    input.todos.length > 0
      ? input.todos
          .map((todo) => `- status=${todo.status} priority=${todo.priority ?? "medium"} content=${todo.content}`)
          .join("\n")
      : "- (none)"

  const decisionsBlock =
    input.state.decisions.length > 0
      ? input.state.decisions.map((decision) => `- ${decision}`).join("\n")
      : "- (none)"

  return [
    "You are compacting a long engineering session for continuity.",
    "Return compacted context in markdown with the exact section structure below.",
    "",
    "Rules:",
    "1) NEVER paraphrase content inside <preserved_messages>.",
    "2) Keep all preserved entries verbatim.",
    "3) Summarize everything else concisely.",
    "4) Keep implementation continuity and pending work explicit.",
    "",
    "## Preserved Messages (verbatim)",
    "<preserved_messages>",
    preserved,
    "</preserved_messages>",
    "",
    "## Session Metadata",
    `<mode>${input.state.mode}</mode>`,
    `<phase>${input.state.phase ?? "unknown"}</phase>`,
    `<subphase>${input.state.subphase ?? "unknown"}</subphase>`,
    `<plan_files_loaded>${input.state.planFiles.length}</plan_files_loaded>`,
    `<modified_files>${input.state.modifiedFiles.join(", ") || "none"}</modified_files>`,
    `<active_subagent_sessions>${input.backgroundSessions.join(", ") || "none"}</active_subagent_sessions>`,
    "",
    "## Todos",
    todoBlock,
    "",
    "## Key Decisions",
    decisionsBlock,
    "",
    "## Required Output",
    "1. Preserved Messages (copy as-is)",
    "2. What was completed",
    "3. Current focus and pending tasks",
    "4. Risks/blockers",
    "5. Immediate next actions",
  ].join("\n")
}

function extractDecisionCandidates(text: string): string[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  return lines
    .filter((line) => /^decision[:\-]/i.test(line) || /\bdecided\b/i.test(line))
    .slice(0, 5)
}

export function createWorkflowContextHook(input: {
  ctx: PluginInput
  workflow: WorkflowStateManager
  background: BackgroundManager
  todoPreserver: TodoPreserver
}) {
  const { ctx, workflow, background, todoPreserver } = input

  return {
    "chat.message": async (
      params: { sessionID: string; messageID?: string },
      output: { parts: unknown[] },
    ): Promise<void> => {
      workflow.refreshMode()
      const first = getFirstTextPart(output.parts)
      if (!first) return

      const updated = workflow.updateFromUserText(params.sessionID, params.messageID, first.text)
      const target = output.parts[first.index] as Record<string, unknown>
      target.text = updated.cleanText

      const shouldInject = workflow.consumePendingPlanInjection(params.sessionID)
      if (!shouldInject) return
      if (workflow.getMode() !== "phase") return

      const state = workflow.getCompactionState(params.sessionID)
      const context = buildPlanContext({
        projectDir: ctx.directory,
        phase: state.phase,
        subphase: state.subphase,
      })
      if (!context.content) return

      prependToFirstText(output.parts, context.content)
      workflow.markPlanFiles(params.sessionID, context.files)
    },

    "tool.execute.after": async (
      params: { tool: string; sessionID: string },
      output: { title?: string; output?: string },
    ): Promise<void> => {
      const path = extractFilePathFromToolOutput(params.tool, output)
      if (!path) return

      if (params.tool.toLowerCase() === "read" && (path.includes("/docs/plan/") || path.includes("/docs/phases/"))) {
        workflow.markPlanFiles(params.sessionID, [path])
      }
      if (["write", "edit", "multiedit"].includes(params.tool.toLowerCase())) {
        workflow.markModifiedFile(params.sessionID, path)
      }
    },

    "command.execute.before": async (
      params: { command: string; sessionID: string; arguments: string },
      _output: { parts: unknown[] },
    ): Promise<void> => {
      const command = params.command.toLowerCase()
      const parsed = parsePhaseArgument(params.arguments)
      if (parsed.phase !== undefined) {
        workflow.setPosition(params.sessionID, parsed.phase, parsed.subphase)
      }

      if (command === "plan-project") {
        ensureDir(join(ctx.directory, "docs", "plan"))
        ensureDir(join(ctx.directory, "docs", "research"))
        return
      }

      if (command === "plan-phase" && parsed.phase !== undefined) {
        ensureDir(join(ctx.directory, "docs", "phases", `phase_${parsed.phase}`, "plan"))
        ensureDir(join(ctx.directory, "docs", "phases", `phase_${parsed.phase}`, "research"))
        return
      }

      if (command === "plan-subphase" && parsed.phase !== undefined && parsed.subphase) {
        ensureDir(join(ctx.directory, "docs", "phases", `phase_${parsed.phase}`, parsed.subphase, "plan"))
        ensureDir(join(ctx.directory, "docs", "phases", `phase_${parsed.phase}`, parsed.subphase, "research"))
        return
      }

      if (command === "progress" && parsed.phase !== undefined && parsed.subphase) {
        ensureDir(join(ctx.directory, "docs", "phases", `phase_${parsed.phase}`, parsed.subphase))
        return
      }

      if (command === "progress-phase" && parsed.phase !== undefined) {
        ensureDir(join(ctx.directory, "docs", "phases", `phase_${parsed.phase}`))
        return
      }

      if (command === "load-context") {
        workflow.markPendingPlanInjection(params.sessionID)
      }
    },

    "experimental.session.compacting": async (
      params: { sessionID: string },
      output: { context: string[]; prompt?: string },
    ): Promise<void> => {
      await todoPreserver.capture(params.sessionID)
      const state = workflow.getCompactionState(params.sessionID)
      const sessions = background
        .listTasks()
        .filter((task) => task.parentSessionID === params.sessionID)
        .map((task) => task.sessionID)
        .filter((value): value is string => typeof value === "string")
      const todoResponse = await ctx.client.session.todo({ path: { id: params.sessionID } }).catch(() => null)
      const todos = Array.isArray((todoResponse as { data?: unknown } | null)?.data)
        ? ((todoResponse as { data: Array<{ content: string; status: string; priority?: string }> }).data)
        : []
      output.prompt = compactionContext({ state, backgroundSessions: sessions, todos })
    },

    event: async ({ event }: { event: { type: string; properties?: unknown } }): Promise<void> => {
      await todoPreserver.event({ event })

      const props = (event.properties ?? {}) as Record<string, unknown>
      if (event.type === "session.deleted") {
        const info = props.info as { id?: string } | undefined
        if (info?.id) workflow.clearSession(info.id)
        return
      }

      if (event.type === "session.compacted") {
        const sessionID = (props.sessionID ?? (props.info as { id?: string } | undefined)?.id) as string | undefined
        if (sessionID) workflow.markNeedsPlanReinject(sessionID)
        return
      }

      if (event.type !== "message.updated") return
      const info = props.info as { sessionID?: string; role?: string; finish?: boolean } | undefined
      if (!info?.sessionID || info.role !== "assistant" || !info.finish) return

      try {
        const messages = await ctx.client.session.messages({ path: { id: info.sessionID } })
        const text = extractLatestAssistantText(messages.data ?? [])
        if (text) {
          workflow.recordAssistantResponse(info.sessionID, text)
          for (const decision of extractDecisionCandidates(text)) {
            workflow.addDecision(info.sessionID, decision)
          }
        }
      } catch (error) {
        log("[workflow-context] failed to capture assistant persisted response", {
          sessionID: info.sessionID,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
  }
}
