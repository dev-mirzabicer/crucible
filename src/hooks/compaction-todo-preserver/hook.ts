import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared/logger"

interface TodoSnapshot {
  id: string
  content: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
  priority?: "low" | "medium" | "high"
}

type TodoWriter = (input: { sessionID: string; todos: TodoSnapshot[] }) => Promise<void>

function extractTodos(response: unknown): TodoSnapshot[] {
  const payload = response as { data?: unknown }
  if (Array.isArray(payload?.data)) {
    return payload.data as TodoSnapshot[]
  }
  if (Array.isArray(response)) {
    return response as TodoSnapshot[]
  }
  return []
}

async function resolveTodoWriter(): Promise<TodoWriter | null> {
  try {
    const loader = "opencode/session/todo"
    const mod = (await import(loader)) as {
      Todo?: { update?: TodoWriter }
    }
    const update = mod.Todo?.update
    return typeof update === "function" ? update : null
  } catch {
    return null
  }
}

function resolveSessionID(props?: Record<string, unknown>): string | undefined {
  return (props?.sessionID ?? (props?.info as { id?: string } | undefined)?.id) as string | undefined
}

export function createCompactionTodoPreserverHook(ctx: PluginInput) {
  const snapshots = new Map<string, TodoSnapshot[]>()

  const capture = async (sessionID: string): Promise<void> => {
    if (!sessionID) return
    try {
      const response = await ctx.client.session.todo({ path: { id: sessionID } })
      const todos = extractTodos(response)
      if (todos.length === 0) return
      snapshots.set(sessionID, todos)
    } catch (error) {
      log("[compaction-todo-preserver] capture failed", {
        sessionID,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const restore = async (sessionID: string): Promise<void> => {
    const snapshot = snapshots.get(sessionID)
    if (!snapshot || snapshot.length === 0) return

    try {
      const response = await ctx.client.session.todo({ path: { id: sessionID } })
      const current = extractTodos(response)
      if (current.length > 0) {
        snapshots.delete(sessionID)
        return
      }
    } catch {
      // continue to restore
    }

    const writer = await resolveTodoWriter()
    if (!writer) return

    try {
      await writer({ sessionID, todos: snapshot })
    } finally {
      snapshots.delete(sessionID)
    }
  }

  const event = async ({ event }: { event: { type: string; properties?: unknown } }) => {
    const props = event.properties as Record<string, unknown> | undefined
    if (event.type === "session.deleted") {
      const sessionID = resolveSessionID(props)
      if (sessionID) snapshots.delete(sessionID)
      return
    }
    if (event.type === "session.compacted") {
      const sessionID = resolveSessionID(props)
      if (sessionID) {
        await restore(sessionID)
      }
    }
  }

  return { capture, event }
}
