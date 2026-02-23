import type { PluginInput } from "@opencode-ai/plugin"

import { buildRetryGuidance } from "./guidance"
import { detectDelegateTaskError } from "./patterns"

export function createDelegateTaskRetryHook(_ctx: PluginInput) {
  return {
    "tool.execute.after": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { title: string; output: string; metadata: unknown },
    ) => {
      const name = input.tool.toLowerCase()
      if (name !== "task" && name !== "agent_invoke" && name !== "call_omo_agent") return
      if (typeof output.output !== "string") return

      const errorInfo = detectDelegateTaskError(output.output)
      if (!errorInfo) return

      output.output += buildRetryGuidance(errorInfo)
    },
  }
}
