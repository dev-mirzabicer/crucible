import { z } from "zod"

export const GitMasterConfigSchema = z.object({
  commit_footer: z.union([z.boolean(), z.string()]).default(true),
  include_co_authored_by: z.boolean().default(true),
})

export type GitMasterConfig = z.infer<typeof GitMasterConfigSchema>
