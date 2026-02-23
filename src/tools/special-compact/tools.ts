import { tool, type PluginInput, type ToolDefinition } from "@opencode-ai/plugin"

import { defaults } from "../../config/defaults"

function parseModelRef(value: string): { providerID: string; modelID: string } {
  const [providerID, ...rest] = value.split("/")
  const modelID = rest.join("/")
  if (!providerID || !modelID) {
    throw new Error(`Invalid model reference: ${value}`)
  }
  return { providerID, modelID }
}

export function createSpecialCompactTool(ctx: PluginInput): ToolDefinition {
  return tool({
    description: "Trigger Crucible custom session compaction for the current session.",
    args: {
      auto: tool.schema.boolean().optional().describe("Mark compaction as automatic or manual"),
      providerID: tool.schema.string().optional().describe("Optional provider override"),
      modelID: tool.schema.string().optional().describe("Optional model override"),
    },
    async execute(
      args: { auto?: boolean; providerID?: string; modelID?: string },
      toolCtx?: { sessionID?: string },
    ) {
      const sessionID = toolCtx?.sessionID
      if (!sessionID) {
        throw new Error("special_compact requires a session context")
      }

      const base = parseModelRef(defaults.agents.builder.model)
      const body = {
        providerID: typeof args.providerID === "string" ? args.providerID : base.providerID,
        modelID: typeof args.modelID === "string" ? args.modelID : base.modelID,
        auto: args.auto === true,
      }

      await ctx.client.session.summarize({
        path: { id: sessionID },
        body,
        query: { directory: ctx.directory },
      })

      return "Compaction requested. Crucible compaction hooks applied."
    },
  })
}
