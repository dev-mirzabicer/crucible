import { log } from "../../shared"

const OPUS_4_6_PATTERN = /claude-opus-4[-.]6/i

function normalizeModelID(modelID: string): string {
  return modelID.replace(/\.(\d+)/g, "-$1")
}

function isClaudeProvider(providerID: string, modelID: string): boolean {
  if (["anthropic", "google-vertex-anthropic", "opencode"].includes(providerID)) return true
  if (providerID === "github-copilot" && modelID.toLowerCase().includes("claude")) return true
  return false
}

function isOpus46(modelID: string): boolean {
  const normalized = normalizeModelID(modelID)
  return OPUS_4_6_PATTERN.test(normalized)
}

interface ChatParamsInput {
  sessionID: string
  agent?: string | { name?: string }
  model: Record<string, unknown>
  provider?: unknown
  message?: Record<string, unknown>
}

interface ChatParamsOutput {
  temperature?: number
  topP?: number
  topK?: number
  options: Record<string, unknown>
}

function extractModelIdentifiers(model: Record<string, unknown>): { providerID: string; modelID: string } | null {
  const providerCandidate =
    (typeof model.providerID === "string" && model.providerID) ||
    (typeof model.provider === "string" && model.provider) ||
    (typeof model.provider === "object" && model.provider !== null &&
      typeof (model.provider as { id?: unknown }).id === "string" &&
      ((model.provider as { id: string }).id))

  const modelCandidate =
    (typeof model.modelID === "string" && model.modelID) ||
    (typeof model.id === "string" && model.id) ||
    (typeof model.name === "string" && model.name)

  if (!providerCandidate || !modelCandidate) {
    return null
  }

  return { providerID: providerCandidate, modelID: modelCandidate }
}

export function createAnthropicEffortHook() {
  return {
    "chat.params": async (
      input: ChatParamsInput,
      output: ChatParamsOutput
    ): Promise<void> => {
      const { model, message } = input
      const ids = extractModelIdentifiers(model)
      if (!ids) return
      const variant = typeof message?.variant === "string" ? message.variant : undefined
      if (variant !== "max") return
      if (!isClaudeProvider(ids.providerID, ids.modelID)) return
      if (!isOpus46(ids.modelID)) return
      if (output.options.effort !== undefined) return

      output.options.effort = "max"
      log("anthropic-effort: injected effort=max", {
        sessionID: input.sessionID,
        provider: ids.providerID,
        model: ids.modelID,
      })
    },
  }
}
