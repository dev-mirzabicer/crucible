import type { PluginInput } from "@opencode-ai/plugin"

const THRESHOLD = 10

export function createAgentUsageReminderHook(_ctx: PluginInput) {
  const counters = new Map<string, number>()

  return {
    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { title: string; output: string; metadata: unknown },
    ) => {
      const toolName = input.tool.toLowerCase()

      if (toolName === "task") {
        counters.set(input.sessionID, 0)
        return
      }

      const value = (counters.get(input.sessionID) ?? 0) + 1
      counters.set(input.sessionID, value)

      if (value < THRESHOLD) return
      counters.set(input.sessionID, 0)

      if (typeof output.output !== "string") return
      output.output +=
        "\n\n[delegation reminder] Consider delegating focused tasks: task(agent=\"researcher|scout|librarian|oracle\", ...)."
    },
  }
}
