import { z } from "zod"

export const BuiltinAgentNameSchema = z.enum([
  "builder",
  "architect",
  "reviewer",
  "researcher",
  "scout",
  "librarian",
  "oracle",
])

export const NativeAgentNameSchema = z.enum([
  "build",
  "plan",
  "general",
  "explore",
])

export const BuiltinSkillNameSchema = z.enum([
  "playwright",
  "agent-browser",
  "dev-browser",
  "frontend-ui-ux",
  "git-master",
])

export const OverridableAgentNameSchema = z.enum([
  "build",
  "plan",
  "general",
  "builder",
  "architect",
  "reviewer",
  "researcher",
  "scout",
  "oracle",
  "librarian",
  "explore",
])

export const AgentNameSchema = BuiltinAgentNameSchema
export type AgentName = z.infer<typeof AgentNameSchema>

export type BuiltinSkillName = z.infer<typeof BuiltinSkillNameSchema>
