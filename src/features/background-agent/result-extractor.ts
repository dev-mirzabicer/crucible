function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function textFromPart(part: unknown, includeThinking: boolean, includeToolResults: boolean): string[] {
  if (!isRecord(part)) return []
  const type = typeof part.type === "string" ? part.type : ""

  if (type === "text" && typeof part.text === "string" && part.text.trim().length > 0) {
    return [part.text]
  }

  if (includeThinking && (type === "thinking" || type === "reasoning")) {
    const value = typeof part.text === "string" ? part.text : typeof part.thinking === "string" ? part.thinking : ""
    if (value.trim().length > 0) {
      return [`[thinking]\n${value}`]
    }
  }

  if (includeToolResults && type === "tool_result") {
    if (typeof part.output === "string" && part.output.trim().length > 0) {
      return [`[tool_result]\n${part.output}`]
    }
    if (Array.isArray(part.content) && part.content.length > 0) {
      return [`[tool_result]\n${JSON.stringify(part.content)}`]
    }
  }

  return []
}

export function extractLatestAssistantText(messages: unknown): string {
  if (!Array.isArray(messages)) return ""
  const assistants = messages.filter((message) => {
    if (!isRecord(message) || !isRecord(message.info)) return false
    return message.info.role === "assistant"
  })
  if (assistants.length === 0) return ""
  const latest = assistants[assistants.length - 1]
  if (!isRecord(latest) || !Array.isArray(latest.parts)) return ""
  return latest.parts.flatMap((part) => textFromPart(part, false, false)).join("\n").trim()
}

export function formatSessionMessages(
  messages: unknown,
  options: { includeThinking: boolean; includeToolResults: boolean; limit?: number },
): string {
  if (!Array.isArray(messages) || messages.length === 0) return "No messages"
  const selected = options.limit && options.limit > 0 ? messages.slice(-options.limit) : messages
  const lines: string[] = []

  for (const item of selected) {
    if (!isRecord(item)) continue
    const info = isRecord(item.info) ? item.info : {}
    const role = typeof info.role === "string" ? info.role : "unknown"
    const id = typeof info.id === "string" ? info.id : ""
    lines.push(`[${role}] ${id}`.trim())

    const parts = Array.isArray(item.parts) ? item.parts : []
    const content = parts.flatMap((part) =>
      textFromPart(part, options.includeThinking, options.includeToolResults),
    )
    if (content.length > 0) {
      lines.push(content.join("\n"))
    }
    lines.push("")
  }

  return lines.join("\n").trim()
}

export function countMessages(messages: unknown): number {
  return Array.isArray(messages) ? messages.length : 0
}
