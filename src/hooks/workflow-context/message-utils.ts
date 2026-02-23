function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function getFirstTextPart(parts: unknown): { index: number; text: string } | null {
  if (!Array.isArray(parts)) return null
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]
    if (!isRecord(part)) continue
    if (part.type !== "text") continue
    if (typeof part.text !== "string") continue
    return { index: i, text: part.text }
  }
  return null
}

export function prependToFirstText(parts: unknown, block: string): void {
  if (!Array.isArray(parts)) return
  const first = getFirstTextPart(parts)
  if (!first) return
  const part = parts[first.index] as Record<string, unknown>
  part.text = `${block}\n\n---\n\n${first.text}`
}

export function extractLatestAssistantText(messages: unknown): string {
  if (!Array.isArray(messages)) return ""
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (!isRecord(message) || !isRecord(message.info)) continue
    if (message.info.role !== "assistant") continue
    const parts = Array.isArray(message.parts) ? message.parts : []
    const text = parts
      .filter((part) => isRecord(part) && part.type === "text" && typeof part.text === "string")
      .map((part) => String(part.text))
      .join("\n")
      .trim()
    if (text) return text
  }
  return ""
}

export function extractFilePathFromToolOutput(tool: string, output: { title?: string; output?: string }): string | undefined {
  const name = tool.toLowerCase()
  if (!["read", "write", "edit", "multiedit"].includes(name)) return undefined
  if (typeof output.title === "string" && output.title.length > 0) {
    const titleMatch = output.title.match(/([A-Za-z]:\\[^\s:]+|\/[\w./~ -]+\.[\w.-]+|\/[\w./~ -]+)/)
    if (titleMatch) return titleMatch[1]
  }
  if (typeof output.output !== "string") return undefined
  const match = output.output.match(/([A-Za-z]:\\[^\s:]+|\/[\w./~ -]+\.[\w.-]+|\/[\w./~ -]+)/)
  if (!match) return undefined
  return match[1]
}
