import { z } from "zod"

export const McpNameSchema = z.enum([
  "context7",
  "grep_app",
  "auggie",
  "tavily",
  "websearch",
])

export type McpName = z.infer<typeof McpNameSchema>

export const AnyMcpNameSchema = z.string().min(1)

export type AnyMcpName = z.infer<typeof AnyMcpNameSchema>
