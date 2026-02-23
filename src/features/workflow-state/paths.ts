import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { createHash } from "node:crypto"

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24)
}

export function workflowRoot(): string {
  const path = join(homedir(), ".local", "share", "crucible", "workflow-state")
  mkdirSync(path, { recursive: true })
  return path
}

export function workflowFile(projectDir: string): string {
  return join(workflowRoot(), `${digest(projectDir)}.json`)
}
