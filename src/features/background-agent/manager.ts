import type { PluginInput } from "@opencode-ai/plugin"

import { log, promptSyncWithModelSuggestionRetry, promptWithModelSuggestionRetry } from "../../shared"
import { subagentSessions } from "../claude-code-session-state"
import { Concurrency } from "./concurrency"
import { DEFAULT_BACKGROUND_TASK_CONFIG, TERMINAL_STATUSES } from "./constants"
import { cleanupOldOutputs, persistTaskOutput } from "./persistence"
import { countMessages, extractLatestAssistantText, formatSessionMessages } from "./result-extractor"
import type {
  BackgroundTask,
  BackgroundTaskConfig,
  ContinueTaskInput,
  LaunchTaskInput,
  WaitOptions,
} from "./types"

function now(): Date {
  return new Date()
}

function taskKey(task: BackgroundTask): string {
  if (task.model) return `${task.model.providerID}/${task.model.modelID}`
  return task.agent
}

function parseSessionStatus(data: unknown, sessionID: string): string | undefined {
  if (!data || typeof data !== "object") return undefined
  const map = data as Record<string, unknown>
  const entry = map[sessionID]
  if (!entry || typeof entry !== "object") return undefined
  const type = (entry as Record<string, unknown>).type
  return typeof type === "string" ? type : undefined
}

function formatTask(task: BackgroundTask): BackgroundTask {
  return { ...task }
}

export class BackgroundManager {
  private readonly client: PluginInput["client"]
  private readonly directory: string
  private readonly concurrency = new Concurrency()
  private readonly tasks = new Map<string, BackgroundTask>()
  private readonly config: BackgroundTaskConfig
  private pollTimer: ReturnType<typeof setInterval> | undefined
  private polling = false
  private readonly continuing = new Set<string>()

  constructor(ctx: PluginInput, config?: Partial<BackgroundTaskConfig>) {
    this.client = ctx.client
    this.directory = ctx.directory
    this.config = {
      ...DEFAULT_BACKGROUND_TASK_CONFIG,
      ...config,
      modelConcurrency: {
        ...DEFAULT_BACKGROUND_TASK_CONFIG.modelConcurrency,
        ...(config?.modelConcurrency ?? {}),
      },
    }
    cleanupOldOutputs()
  }

  private limit(key: string): number {
    return this.config.modelConcurrency[key] ?? this.config.defaultConcurrency
  }

  private startPolling(): void {
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => {
      void this.pollRunningTasks()
    }, this.config.pollIntervalMs)
    this.pollTimer.unref()
  }

  private stopPollingIfIdle(): void {
    const hasRunning = [...this.tasks.values()].some((task) => task.status === "running")
    if (hasRunning) return
    if (!this.pollTimer) return
    clearInterval(this.pollTimer)
    this.pollTimer = undefined
  }

  private maybePump(key: string): void {
    while (this.concurrency.current(key) < this.limit(key)) {
      const id = this.concurrency.next(key)
      if (!id) return
      void this.startTask(id)
    }
  }

  private releaseSlot(task: BackgroundTask): void {
    if (!task.slotAcquired) return
    this.concurrency.release(taskKey(task))
    task.slotAcquired = false
  }

  private async startTask(taskID: string): Promise<void> {
    const task = this.tasks.get(taskID)
    if (!task || task.status !== "pending") return

    const key = taskKey(task)
    this.concurrency.acquire(key)
    task.slotAcquired = true

    try {
      const parent = await this.client.session.get({ path: { id: task.parentSessionID } }).catch(() => null)
      const parentDir = (parent as { data?: { directory?: string } } | null)?.data?.directory ?? this.directory
      const createResult = await this.client.session.create({
        body: {
          parentID: task.parentSessionID,
          title: `${task.description} (@${task.agent})`,
        } as never,
        query: { directory: parentDir },
      })

      if (createResult.error || !createResult.data?.id) {
        throw new Error(`Failed to create child session: ${createResult.error ?? "unknown"}`)
      }

      task.sessionID = createResult.data.id
      task.status = "running"
      task.startedAt = now()
      task.lastActivityAt = now()
      task.idleSeen = false
      task.lastMessageCount = 0
      task.stablePolls = 0
      subagentSessions.add(task.sessionID)

      const body = {
        agent: task.agent,
        ...(task.model
          ? {
              model: {
                providerID: task.model.providerID,
                modelID: task.model.modelID,
              },
            }
          : {}),
        ...(task.model?.variant ? { variant: task.model.variant } : {}),
        parts: [{ type: "text", text: task.prompt }],
      }

      if (task.runInBackground) {
        await promptWithModelSuggestionRetry(this.client, {
          path: { id: task.sessionID },
          body,
        })
      } else {
        await promptSyncWithModelSuggestionRetry(this.client, {
          path: { id: task.sessionID },
          body,
        })
      }

      this.startPolling()
      log("[background-agent] started task", {
        taskID: task.id,
        sessionID: task.sessionID,
        agent: task.agent,
      })
    } catch (error) {
      task.status = "failed"
      task.error = error instanceof Error ? error.message : String(error)
      task.completedAt = now()
      task.outputFile = persistTaskOutput(task)
      if (task.sessionID) {
        subagentSessions.delete(task.sessionID)
        void this.client.session.abort({ path: { id: task.sessionID } }).catch(() => {})
      }
      this.releaseSlot(task)
      this.maybePump(key)
      this.stopPollingIfIdle()
      return
    }
  }

  async launch(input: LaunchTaskInput): Promise<BackgroundTask> {
    const task: BackgroundTask = {
      id: `bg_${crypto.randomUUID().slice(0, 8)}`,
      description: input.description,
      prompt: input.prompt,
      agent: input.agent,
      parentSessionID: input.parentSessionID,
      parentMessageID: input.parentMessageID,
      parentAgent: input.parentAgent,
      model: input.model,
      status: "pending",
      queuedAt: now(),
      lastActivityAt: now(),
      runInBackground: input.runInBackground,
    }

    this.tasks.set(task.id, task)
    const key = taskKey(task)
    this.concurrency.enqueue(key, task.id)
    this.maybePump(key)
    return formatTask(task)
  }

  async continueSession(input: ContinueTaskInput): Promise<BackgroundTask> {
    if (this.continuing.has(input.sessionID)) {
      throw new Error(`Concurrent continuation blocked for session ${input.sessionID}`)
    }
    this.continuing.add(input.sessionID)

    try {
    const existing = [...this.tasks.values()].find((task) => task.sessionID === input.sessionID)
    const task =
      existing ??
      ({
        id: `bg_${crypto.randomUUID().slice(0, 8)}`,
        description: input.description,
        prompt: input.prompt,
        agent: input.agent,
        parentSessionID: input.parentSessionID,
        parentMessageID: input.parentMessageID,
        parentAgent: input.parentAgent,
        sessionID: input.sessionID,
        model: input.model,
        status: "running",
        queuedAt: now(),
        startedAt: now(),
        lastActivityAt: now(),
        runInBackground: input.runInBackground,
      } satisfies BackgroundTask)

    if (!existing) {
      this.tasks.set(task.id, task)
      this.concurrency.acquire(taskKey(task))
      task.slotAcquired = true
    } else {
      if (TERMINAL_STATUSES.has(existing.status)) {
        throw new Error(`Cannot continue terminal task ${existing.id} (${existing.status}). Start a new task without session_id.`)
      }
      if (!existing.slotAcquired) {
        this.concurrency.acquire(taskKey(existing))
        existing.slotAcquired = true
      }
      existing.status = "running"
      existing.error = undefined
      existing.result = undefined
      existing.completedAt = undefined
      existing.prompt = input.prompt
      existing.parentSessionID = input.parentSessionID
      existing.parentMessageID = input.parentMessageID
      existing.parentAgent = input.parentAgent
      existing.lastActivityAt = now()
      existing.stablePolls = 0
      existing.lastMessageCount = undefined
    }

    const body = {
      agent: task.agent,
      ...(task.model
        ? {
            model: {
              providerID: task.model.providerID,
              modelID: task.model.modelID,
            },
          }
        : {}),
      ...(task.model?.variant ? { variant: task.model.variant } : {}),
      parts: [{ type: "text", text: input.prompt }],
    }

    if (task.runInBackground) {
      await promptWithModelSuggestionRetry(this.client, {
        path: { id: input.sessionID },
        body,
      })
    } else {
      await promptSyncWithModelSuggestionRetry(this.client, {
        path: { id: input.sessionID },
        body,
      })
    }

    this.startPolling()
    return formatTask(task)
    } finally {
      this.continuing.delete(input.sessionID)
    }
  }

  private completeTask(task: BackgroundTask, result: string): void {
    if (task.status !== "running") return
    task.status = "completed"
    task.result = result
    task.completedAt = now()
    task.outputFile = persistTaskOutput(task)
    if (task.sessionID) subagentSessions.delete(task.sessionID)
    this.releaseSlot(task)
    this.maybePump(taskKey(task))
    this.stopPollingIfIdle()
  }

  private failTask(task: BackgroundTask, error: string): void {
    if (TERMINAL_STATUSES.has(task.status)) return
    task.status = "failed"
    task.error = error
    task.completedAt = now()
    task.outputFile = persistTaskOutput(task)
    if (task.sessionID) {
      subagentSessions.delete(task.sessionID)
      void this.client.session.abort({ path: { id: task.sessionID } }).catch(() => {})
    }
    this.releaseSlot(task)
    this.maybePump(taskKey(task))
    this.stopPollingIfIdle()
  }

  async pollRunningTasks(): Promise<void> {
    if (this.polling) return
    this.polling = true
    try {
      const statuses = await this.client.session.status().catch(() => null)
      const statusMap = statuses?.data
      const running = [...this.tasks.values()].filter((task) => task.status === "running")

      for (const task of running) {
        const stale = Date.now() - task.lastActivityAt.getTime() > this.config.staleTimeoutMs
        if (stale) {
          this.failTask(task, "Task timed out due to inactivity")
          continue
        }

        if (!task.sessionID) {
          this.failTask(task, "Missing child session ID")
          continue
        }

        const status = parseSessionStatus(statusMap, task.sessionID)
        if (!status) {
          continue
        }
        if (status && status !== "idle") {
          task.lastActivityAt = now()
          task.idleSeen = false
          task.stablePolls = 0
          continue
        }

        if (status === "idle") {
          const runtimeMs = task.startedAt ? Date.now() - task.startedAt.getTime() : 0
          if (runtimeMs < this.config.minimumRuntimeMs) {
            continue
          }
          if (Date.now() - task.lastActivityAt.getTime() < this.config.quietPeriodMs) {
            continue
          }

          const messagesResult = await this.client.session.messages({ path: { id: task.sessionID } }).catch(() => null)
          const messages = messagesResult?.data ?? []
          const count = countMessages(messages)

          if ((task.lastMessageCount ?? -1) === count) {
            task.stablePolls = (task.stablePolls ?? 0) + 1
          } else {
            task.stablePolls = 0
            task.lastMessageCount = count
          }

          if ((task.stablePolls ?? 0) < this.config.stablePollThreshold) {
            continue
          }

          const result = extractLatestAssistantText(messages)
          this.completeTask(task, result)
        }
      }
    } finally {
      this.polling = false
    }
  }

  getTask(taskID: string): BackgroundTask | undefined {
    const task = this.tasks.get(taskID)
    return task ? formatTask(task) : undefined
  }

  listTasks(): BackgroundTask[] {
    return [...this.tasks.values()].map(formatTask)
  }

  async cancelTask(taskID: string): Promise<boolean> {
    const task = this.tasks.get(taskID)
    if (!task) return false

    if (task.status === "pending") {
      this.concurrency.remove(taskKey(task), task.id)
    }

    if (task.status === "running" && task.sessionID) {
      await this.client.session.abort({ path: { id: task.sessionID } }).catch(() => {})
    }

    task.status = "cancelled"
    task.completedAt = now()
    task.outputFile = persistTaskOutput(task)
    if (task.sessionID) subagentSessions.delete(task.sessionID)
    this.releaseSlot(task)
    this.maybePump(taskKey(task))
    this.stopPollingIfIdle()
    return true
  }

  async cancelAll(): Promise<number> {
    const targets = [...this.tasks.values()].filter(
      (task) => task.status === "pending" || task.status === "running",
    )
    let count = 0
    for (const task of targets) {
      const cancelled = await this.cancelTask(task.id)
      if (cancelled) count += 1
    }
    return count
  }

  async waitFor(taskID: string, options?: WaitOptions): Promise<BackgroundTask> {
    const timeoutMs = options?.timeoutMs ?? this.config.defaultWaitTimeoutMs
    const started = Date.now()

    while (true) {
      const task = this.tasks.get(taskID)
      if (!task) {
        throw new Error(`Task not found: ${taskID}`)
      }

      if (TERMINAL_STATUSES.has(task.status)) {
        return formatTask(task)
      }

      if (timeoutMs !== undefined && timeoutMs > 0 && Date.now() - started > timeoutMs) {
        throw new Error(`Timed out waiting for task ${taskID}`)
      }

      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }

  async getFormattedSession(taskID: string, options: { includeThinking: boolean; includeToolResults: boolean; limit?: number }): Promise<string> {
    const task = this.tasks.get(taskID)
    if (!task) {
      throw new Error(`Task not found: ${taskID}`)
    }
    if (!task.sessionID) {
      return "No child session"
    }
    const result = await this.client.session.messages({ path: { id: task.sessionID } })
    if (result.error) {
      throw new Error(String(result.error))
    }
    return formatSessionMessages(result.data ?? [], options)
  }

  handleEvent(event: { type: string; properties?: unknown }): void {
    const props = (event.properties ?? {}) as Record<string, unknown>
    if (event.type === "message.updated" || event.type === "message.part.updated" || event.type === "message.part.delta") {
      const info = (props.info ?? props) as Record<string, unknown>
      const sessionID = typeof info.sessionID === "string" ? info.sessionID : undefined
      if (!sessionID) return
      const task = [...this.tasks.values()].find((item) => item.sessionID === sessionID && item.status === "running")
      if (!task) return
      task.lastActivityAt = now()
      task.stablePolls = 0
      task.lastMessageCount = undefined
      return
    }

    if (event.type === "session.error") {
      const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined
      if (!sessionID) return
      const task = [...this.tasks.values()].find((item) => item.sessionID === sessionID)
      if (!task) return
      const err = props.error
      const text =
        typeof err === "string"
          ? err
          : typeof err === "object" && err !== null && typeof (err as Record<string, unknown>).message === "string"
            ? String((err as Record<string, unknown>).message)
            : "Session error"
      this.failTask(task, text)
      return
    }

    if (event.type === "session.deleted") {
      const info = props.info as { id?: string } | undefined
      const id = info?.id
      if (!id) return
      const targets = [...this.tasks.values()].filter((task) => task.sessionID === id)
      for (const task of targets) {
        task.status = "cancelled"
        task.completedAt = now()
        task.outputFile = persistTaskOutput(task)
        if (task.sessionID) {
          subagentSessions.delete(task.sessionID)
        }
        this.releaseSlot(task)
        this.maybePump(taskKey(task))
      }
      this.stopPollingIfIdle()
    }
  }
}
