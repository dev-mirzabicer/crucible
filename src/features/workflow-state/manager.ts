import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import type { PersistEntry, ProjectWorkflowState, SessionWorkflowState, WorkflowMode } from "./types"
import { workflowFile } from "./paths"

function uniq(values: string[]): string[] {
  return [...new Set(values)]
}

function initSession(sessionID: string): SessionWorkflowState {
  return {
    sessionID,
    firstMessageSeen: false,
    needsPlanReinject: false,
    pendingPlanInjection: false,
    loadedPlanFiles: [],
    modifiedFiles: [],
    keyDecisions: [],
    persistEntries: [],
    pendingPersistResponses: 0,
  }
}

function normalizeSession(session: SessionWorkflowState): SessionWorkflowState {
  const pendingRaw = (session as SessionWorkflowState & { pendingPersistResponse?: boolean }).pendingPersistResponse
  const pendingPersistResponses =
    typeof session.pendingPersistResponses === "number"
      ? Math.max(0, session.pendingPersistResponses)
      : pendingRaw
        ? 1
        : 0

  return {
    ...session,
    pendingPersistResponses,
    pendingPlanInjection: Boolean(session.pendingPlanInjection),
    loadedPlanFiles: Array.isArray(session.loadedPlanFiles) ? session.loadedPlanFiles : [],
    modifiedFiles: Array.isArray(session.modifiedFiles) ? session.modifiedFiles : [],
    keyDecisions: Array.isArray(session.keyDecisions) ? session.keyDecisions : [],
    persistEntries: Array.isArray(session.persistEntries) ? session.persistEntries : [],
  }
}

function detectMode(projectDir: string): WorkflowMode {
  return existsSync(join(projectDir, "docs", "plan")) ? "phase" : "general"
}

export class WorkflowStateManager {
  private readonly projectDir: string
  private readonly path: string
  private state: ProjectWorkflowState

  constructor(projectDir: string) {
    this.projectDir = projectDir
    this.path = workflowFile(projectDir)
    this.state = this.load()
  }

  private load(): ProjectWorkflowState {
    if (!existsSync(this.path)) {
      return {
        projectDir: this.projectDir,
        mode: detectMode(this.projectDir),
        sessions: {},
      }
    }

    try {
      const raw = readFileSync(this.path, "utf-8")
      const parsed = JSON.parse(raw) as ProjectWorkflowState
      return {
        projectDir: this.projectDir,
        mode: detectMode(this.projectDir),
        currentPhase: parsed.currentPhase,
        currentSubphase: parsed.currentSubphase,
        sessions: Object.fromEntries(
          Object.entries(parsed.sessions ?? {}).map(([id, session]) => [
            id,
            normalizeSession(session as SessionWorkflowState),
          ]),
        ),
      }
    } catch {
      return {
        projectDir: this.projectDir,
        mode: detectMode(this.projectDir),
        sessions: {},
      }
    }
  }

  private save(): void {
    const tmp = `${this.path}.tmp`
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), "utf-8")
    renameSync(tmp, this.path)
  }

  refreshMode(): WorkflowMode {
    const mode = detectMode(this.projectDir)
    if (mode !== this.state.mode) {
      this.state.mode = mode
      this.save()
    }
    return this.state.mode
  }

  getMode(): WorkflowMode {
    return this.state.mode
  }

  getSession(sessionID: string): SessionWorkflowState {
    if (!this.state.sessions[sessionID]) {
      this.state.sessions[sessionID] = initSession(sessionID)
    }
    return this.state.sessions[sessionID]
  }

  updateFromUserText(sessionID: string, messageID: string | undefined, text: string): { cleanText: string; isFirstMessage: boolean; persistDetected: boolean } {
    const session = this.getSession(sessionID)
    const trimmed = text.trimStart()
    const persistDetected = trimmed.startsWith("[PERSIST]")
    const cleanText = persistDetected ? trimmed.replace(/^\[PERSIST\]\s*/m, "") : text

    if (persistDetected) {
      const entry: PersistEntry = {
        userMessageID: messageID,
        userText: cleanText,
        createdAt: new Date().toISOString(),
      }
      session.persistEntries.push(entry)
      session.pendingPersistResponses += 1
    }

    const isFirstMessage = !session.firstMessageSeen
    session.firstMessageSeen = true
    if (isFirstMessage) {
      session.pendingPlanInjection = true
    }
    this.save()
    return { cleanText, isFirstMessage, persistDetected }
  }

  recordAssistantResponse(sessionID: string, text: string): void {
    const session = this.getSession(sessionID)
    if (session.pendingPersistResponses <= 0) return
    const target = session.persistEntries.find((entry) => entry.assistantText === undefined)
    if (!target) return
    target.assistantText = text
    session.pendingPersistResponses = Math.max(0, session.pendingPersistResponses - 1)
    this.save()
  }

  markPlanFiles(sessionID: string, files: string[]): void {
    const session = this.getSession(sessionID)
    session.loadedPlanFiles = uniq([...session.loadedPlanFiles, ...files])
    this.save()
  }

  markModifiedFile(sessionID: string, file: string): void {
    const session = this.getSession(sessionID)
    session.modifiedFiles = uniq([...session.modifiedFiles, file])
    this.save()
  }

  markNeedsPlanReinject(sessionID: string): void {
    const session = this.getSession(sessionID)
    session.needsPlanReinject = true
    session.pendingPlanInjection = true
    this.save()
  }

  consumePlanReinjectFlag(sessionID: string): boolean {
    const session = this.getSession(sessionID)
    const value = session.needsPlanReinject
    session.needsPlanReinject = false
    this.save()
    return value
  }

  consumePendingPlanInjection(sessionID: string): boolean {
    const session = this.getSession(sessionID)
    const value = session.pendingPlanInjection
    session.pendingPlanInjection = false
    this.save()
    return value
  }

  markPendingPlanInjection(sessionID: string): void {
    const session = this.getSession(sessionID)
    session.pendingPlanInjection = true
    this.save()
  }

  addDecision(sessionID: string, decision: string): void {
    const session = this.getSession(sessionID)
    session.keyDecisions = uniq([...session.keyDecisions, decision])
    this.save()
  }

  setPosition(sessionID: string, phase?: number, subphase?: string): void {
    const session = this.getSession(sessionID)
    if (phase !== undefined) {
      session.currentPhase = phase
      this.state.currentPhase = phase
    }
    if (subphase !== undefined) {
      session.currentSubphase = subphase
      this.state.currentSubphase = subphase
    }
    session.pendingPlanInjection = true
    this.save()
  }

  getCompactionState(sessionID: string): {
    mode: WorkflowMode
    phase?: number
    subphase?: string
    planFiles: string[]
    modifiedFiles: string[]
    decisions: string[]
    persistEntries: PersistEntry[]
  } {
    const session = this.getSession(sessionID)
    return {
      mode: this.state.mode,
      phase: session.currentPhase ?? this.state.currentPhase,
      subphase: session.currentSubphase ?? this.state.currentSubphase,
      planFiles: session.loadedPlanFiles,
      modifiedFiles: session.modifiedFiles,
      decisions: session.keyDecisions,
      persistEntries: session.persistEntries,
    }
  }

  clearSession(sessionID: string): void {
    delete this.state.sessions[sessionID]
    this.save()
  }
}
