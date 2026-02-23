import { z } from "zod"

export const BuiltinCommandNameSchema = z.enum([
  "init-deep",
  "refactor",
  "handoff",
])

export type BuiltinCommandName = z.infer<typeof BuiltinCommandNameSchema>
