import type { PluginInput } from "@opencode-ai/plugin"

import { log } from "../../shared"

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>
    if (typeof record.message === "string") return record.message
    if (typeof record.error === "string") return record.error
  }
  return ""
}

function recoverable(message: string): boolean {
  const value = message.toLowerCase()
  return (
    value.includes("tool_result") ||
    value.includes("thinking block") ||
    value.includes("assistant prefill") ||
    value.includes("empty content")
  )
}

function extractLastUserText(messages: unknown): string {
  if (!Array.isArray(messages)) return ""
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (typeof message !== "object" || message === null) continue
    const info = (message as Record<string, unknown>).info
    if (typeof info !== "object" || info === null) continue
    if ((info as Record<string, unknown>).role !== "user") continue
    const parts = (message as Record<string, unknown>).parts
    if (!Array.isArray(parts)) continue
    const text = parts
      .filter((part) => typeof part === "object" && part !== null)
      .filter((part) => (part as Record<string, unknown>).type === "text")
      .map((part) => (typeof (part as Record<string, unknown>).text === "string" ? String((part as Record<string, unknown>).text) : ""))
      .join("\n")
      .trim()
    if (text) return text
  }
  return ""
}

export function createSessionRecoveryHook(ctx: PluginInput) {
  const processing = new Set<string>()

  return {
    event: async ({ event }: { event: { type: string; properties?: unknown } }) => {
      if (event.type !== "session.error") return
      const props = (event.properties ?? {}) as Record<string, unknown>
      const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined
      if (!sessionID) return

      const errorMessage = extractErrorMessage(props.error)
      if (!recoverable(errorMessage)) return

      const key = `${sessionID}:${errorMessage}`
      if (processing.has(key)) return
      processing.add(key)

      try {
        await ctx.client.session.abort({ path: { id: sessionID } }).catch(() => {})

        const messages = await ctx.client.session.messages({ path: { id: sessionID } }).catch(() => null)
        const userText = extractLastUserText(messages?.data ?? [])
        if (!userText) return

        const resumePrompt = [
          "[SYSTEM DIRECTIVE: CRUCIBLE - SESSION RECOVERY]",
          `Recovered from session error: ${errorMessage}`,
          "Resume the previous task from the last valid state.",
          "Do not emit malformed tool result structures.",
          "",
          "Last user intent:",
          userText,
        ].join("\n")

        await ctx.client.session.promptAsync({
          path: { id: sessionID },
          body: {
            parts: [{ type: "text", text: resumePrompt }],
          },
        })
      } catch (error) {
        log("[session-recovery] failed", {
          sessionID,
          error: error instanceof Error ? error.message : String(error),
        })
      } finally {
        processing.delete(key)
      }
    },
  }
}
