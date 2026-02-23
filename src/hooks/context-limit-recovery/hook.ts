import type { PluginInput } from "@opencode-ai/plugin"

import { log } from "../../shared"

function errorText(error: unknown): string {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>
    if (typeof record.message === "string") return record.message
    if (typeof record.error === "string") return record.error
  }
  return ""
}

function isContextLimit(message: string): boolean {
  const value = message.toLowerCase()
  return (
    value.includes("context") && value.includes("limit") ||
    value.includes("maximum context") ||
    value.includes("input too long") ||
    value.includes("too many tokens")
  )
}

function dedupeConsecutive(messages: unknown[]): unknown[] {
  const out: unknown[] = []
  let last = ""
  for (const item of messages) {
    const encoded = JSON.stringify(item)
    if (encoded === last) continue
    out.push(item)
    last = encoded
  }
  return out
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function messageSize(message: unknown): number {
  return JSON.stringify(message).length
}

function truncateLargestParts(messages: unknown[], maxChars: number): unknown[] {
  return messages.map((message) => {
    if (!isRecord(message) || !Array.isArray(message.parts)) return message
    const parts = message.parts.map((part) => {
      if (!isRecord(part)) return part
      const type = typeof part.type === "string" ? part.type : ""
      if (type !== "tool_result" && type !== "tool" && type !== "text") return part

      const output = typeof part.output === "string" ? part.output : ""
      const text = typeof part.text === "string" ? part.text : ""

      if (output.length > maxChars) {
        return {
          ...part,
          output: `${output.slice(0, maxChars)}\n...[truncated by context-limit-recovery]`,
        }
      }
      if (text.length > maxChars) {
        return {
          ...part,
          text: `${text.slice(0, maxChars)}\n...[truncated by context-limit-recovery]`,
        }
      }
      return part
    })
    return { ...message, parts }
  })
}

function summarize(messages: unknown[]): string {
  const tail = messages.slice(-16)
  const lines: string[] = []
  for (const item of tail) {
    if (!isRecord(item)) continue
    const info = item.info
    const role =
      typeof info === "object" && info !== null && typeof (info as Record<string, unknown>).role === "string"
        ? String((info as Record<string, unknown>).role)
        : "unknown"
    const parts = Array.isArray(item.parts) ? item.parts : []
    const preview = parts
      .filter((part) => isRecord(part))
      .map((part) => {
        const text = typeof part.text === "string" ? part.text : typeof part.output === "string" ? part.output : ""
        return text.trim()
      })
      .find((value) => value.length > 0)
    lines.push(`- ${role}${preview ? `: ${preview.slice(0, 180)}` : ""}`)
  }
  return lines.join("\n")
}

function applyCascade(messages: unknown[]): { compacted: unknown[]; strategy: string } {
  const deduped = dedupeConsecutive(messages)
  const largest = deduped.reduce((acc: number, item) => Math.max(acc, messageSize(item)), 0)

  if (largest <= 8_000) {
    return { compacted: deduped, strategy: "dedupe" }
  }

  const truncated = truncateLargestParts(deduped, 2_000)
  const truncatedLargest = truncated.reduce((acc: number, item) => Math.max(acc, messageSize(item)), 0)
  if (truncatedLargest <= 8_000) {
    return { compacted: truncated, strategy: "dedupe+truncate-largest" }
  }

  const summarized = [
    {
      info: { role: "system" },
      parts: [{ type: "text", text: summarize(truncated) }],
    },
  ]
  return { compacted: summarized, strategy: "dedupe+truncate-largest+summarize" }
}

export function createContextLimitRecoveryHook(ctx: PluginInput) {
  const processing = new Set<string>()

  return {
    event: async ({ event }: { event: { type: string; properties?: unknown } }) => {
      if (event.type !== "session.error") return
      const props = (event.properties ?? {}) as Record<string, unknown>
      const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined
      if (!sessionID) return

      const message = errorText(props.error)
      if (!isContextLimit(message)) return

      if (processing.has(sessionID)) return
      processing.add(sessionID)

      try {
        await ctx.client.session.abort({ path: { id: sessionID } }).catch(() => {})

        const response = await ctx.client.session.messages({ path: { id: sessionID } }).catch(() => null)
        const messages = Array.isArray(response?.data) ? response.data : []
        const { compacted, strategy } = applyCascade(messages)
        const compactSummary = summarize(compacted)

        const recoveryPrompt = [
          "[SYSTEM DIRECTIVE: CRUCIBLE - CONTEXT LIMIT RECOVERY]",
          "Previous attempt hit context limit.",
          `Applied strategy: ${strategy}`,
          "Continue using this compact state summary.",
          "Avoid redundant reads and duplicate tool outputs.",
          "",
          "Recent compact state:",
          compactSummary,
        ].join("\n")

        await ctx.client.session.promptAsync({
          path: { id: sessionID },
          body: {
            parts: [{ type: "text", text: recoveryPrompt }],
          },
        })
      } catch (error) {
        log("[context-limit-recovery] failed", {
          sessionID,
          error: error instanceof Error ? error.message : String(error),
        })
      } finally {
        processing.delete(sessionID)
      }
    },
  }
}
