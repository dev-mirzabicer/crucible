import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import type { BackgroundTask } from "./types"

const RETENTION_DAYS = 30
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000

function outputRoot(): string {
  return join(homedir(), ".local", "share", "crucible", "subagent-outputs")
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true })
}

function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-")
}

export function persistTaskOutput(task: BackgroundTask): string {
  const root = outputRoot()
  const parent = safeFilename(task.parentSessionID || "unknown-parent")
  const dir = join(root, parent)
  ensureDir(dir)

  const file = join(dir, `${safeFilename(task.id)}.md`)
  const lines = [
    "# Background Task Output",
    "",
    `- Task ID: ${task.id}`,
    `- Agent: ${task.agent}`,
    `- Model: ${task.model ? `${task.model.providerID}/${task.model.modelID}${task.model.variant ? ` (${task.model.variant})` : ""}` : "(default)"}`,
    `- Parent Session: ${task.parentSessionID}`,
    `- Child Session: ${task.sessionID ?? "(none)"}`,
    `- Status: ${task.status}`,
    `- Queued At: ${task.queuedAt.toISOString()}`,
    `- Started At: ${task.startedAt?.toISOString() ?? "(none)"}`,
    `- Completed At: ${task.completedAt?.toISOString() ?? "(none)"}`,
    "",
    "## Prompt",
    "",
    task.prompt,
    "",
    "## Result",
    "",
    task.result ?? "",
    "",
    "## Error",
    "",
    task.error ?? "",
    "",
  ]

  writeFileSync(file, lines.join("\n"), "utf-8")
  return file
}

function walkFiles(root: string): string[] {
  const out: string[] = []
  const entries = readdirSync(root, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkFiles(path))
      continue
    }
    out.push(path)
  }
  return out
}

export function cleanupOldOutputs(): void {
  const root = outputRoot()
  try {
    ensureDir(root)
    const files = walkFiles(root)
    const now = Date.now()
    for (const file of files) {
      const stat = statSync(file)
      if (now - stat.mtimeMs <= RETENTION_MS) continue
      rmSync(file, { force: true })
    }
  } catch {
    return
  }
}

export function readPersistedOutput(path: string): string | undefined {
  try {
    return readFileSync(path, "utf-8")
  } catch {
    return undefined
  }
}
