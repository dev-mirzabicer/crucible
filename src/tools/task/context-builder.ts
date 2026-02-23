import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import type { PluginInput } from "@opencode-ai/plugin"

import type { BackgroundTaskContextOptions } from "../../features/background-agent"
import { WorkflowStateManager } from "../../features/workflow-state"
import { buildPlanContext } from "../../hooks/workflow-context/plan-context"
import { log } from "../../shared"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function collectMarkdownFiles(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  const entries = readdirSync(root)
  for (const entry of entries) {
    const path = join(root, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      out.push(...collectMarkdownFiles(path))
      continue
    }
    if (entry.toLowerCase().endsWith(".md")) out.push(path)
  }
  return out.sort((a, b) => a.localeCompare(b))
}

function textParts(parts: unknown): string {
  if (!Array.isArray(parts)) return ""
  return parts
    .filter((part) => isRecord(part) && part.type === "text" && typeof part.text === "string")
    .map((part) => String(part.text))
    .join("\n")
    .trim()
}

function collectPersistBlocks(messages: unknown): string[] {
  if (!Array.isArray(messages)) return []
  const lines: string[] = []
  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i]
    if (!isRecord(message) || !isRecord(message.info)) continue
    if (message.info.role !== "user") continue
    const text = textParts(message.parts)
    if (!text.startsWith("[PERSIST]")) continue

    lines.push("### Persisted User Message")
    lines.push(text.replace(/^\[PERSIST\]\s*/m, "").trim())
    const next = messages[i + 1]
    if (!isRecord(next) || !isRecord(next.info) || next.info.role !== "assistant") continue
    const response = textParts(next.parts)
    if (!response) continue
    lines.push("### Persisted Assistant Response")
    lines.push(response)
  }
  return lines
}

function collectPersistBlocksFromState(entries: Array<{ userText: string; assistantText?: string }>): string[] {
  const lines: string[] = []
  for (const entry of entries) {
    if (!entry.userText?.trim()) continue
    lines.push("### Persisted User Message")
    lines.push(entry.userText.trim())
    if (entry.assistantText?.trim()) {
      lines.push("### Persisted Assistant Response")
      lines.push(entry.assistantText.trim())
    }
  }
  return lines
}

function findToolParts(messages: unknown, options: BackgroundTaskContextOptions): string[] {
  if (!Array.isArray(messages)) return []
  const specific = new Set(options.specificToolCallIDs ?? [])
  const recent = options.recentToolCalls ?? 0
  const selected: string[] = []

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (!isRecord(message) || !Array.isArray(message.parts)) continue

    for (let j = message.parts.length - 1; j >= 0; j -= 1) {
      const part = message.parts[j]
      if (!isRecord(part)) continue
      const type = typeof part.type === "string" ? part.type : ""
      if (type !== "tool" && type !== "tool_result" && type !== "tool_use") continue
      const callID =
        (typeof part.callID === "string" && part.callID) ||
        (typeof part.callId === "string" && part.callId) ||
        ""
      const includeBySpecific = callID && specific.size > 0 && specific.has(callID)
      const includeByRecent = recent > 0 && specific.size === 0
      if (!includeBySpecific && !includeByRecent) continue
      selected.push(JSON.stringify(part))
      if (includeByRecent && selected.length >= recent) break
    }
    if (recent > 0 && selected.length >= recent) break
  }

  return selected.reverse().map((entry) => `- ${entry}`)
}

export async function buildDelegationPrompt(input: {
  ctx: PluginInput
  parentSessionID: string
  prompt: string
  freshContext: boolean
  options: BackgroundTaskContextOptions
}): Promise<string> {
  if (input.freshContext) return input.prompt

  const options = {
    includePlanContext: true,
    includePersistMessages: true,
    ...input.options,
  }

  const sections: string[] = ["## Task", input.prompt]
  const workflow = new WorkflowStateManager(input.ctx.directory)
  const sessionState = workflow.getCompactionState(input.parentSessionID)

  const messagesResult = await input.ctx.client.session.messages({
    path: { id: input.parentSessionID },
  }).catch((error) => {
    log("[task-context] failed to load parent session messages", {
      parentSessionID: input.parentSessionID,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  })
  const messages = messagesResult?.data ?? []

  if (options.includePlanContext) {
    const built = buildPlanContext({
      projectDir: input.ctx.directory,
      phase: sessionState.phase,
      subphase: sessionState.subphase,
    })
    if (built.content) {
      sections.push(built.content)
    } else {
      const files = collectMarkdownFiles(join(input.ctx.directory, "docs", "plan"))
      if (files.length > 0) {
        sections.push("## Required Plan Reads")
        sections.push("Read these files before executing the delegated task:")
        sections.push(...files.map((file) => `- ${file.replace(`${input.ctx.directory}/`, "")}`))
      }
    }
  }

  if (Array.isArray(options.files) && options.files.length > 0) {
    const existingFiles = options.files
      .map((file) => (file.startsWith("/") ? file : join(input.ctx.directory, file)))
      .filter((file) => existsSync(file))
    if (existingFiles.length > 0) {
      sections.push("## Explicit File Context")
      for (const file of existingFiles) {
        const rel = file.replace(`${input.ctx.directory}/`, "")
        sections.push(`### ${rel}`)
        sections.push(readFileSync(file, "utf-8"))
      }
    }
  }

  if (options.includePersistMessages) {
    const fromState = collectPersistBlocksFromState(sessionState.persistEntries)
    const persist = fromState.length > 0 ? fromState : collectPersistBlocks(messages)
    if (persist.length > 0) {
      sections.push("## Persisted Session Context")
      sections.push(...persist)
    }
  }

  const toolParts = findToolParts(messages, options)
  if (toolParts.length > 0) {
    sections.push("## Tool Call Context")
    sections.push(...toolParts)
  }

  return sections.join("\n\n")
}
