import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import {
  PHASE_PLAN_RATIO_RANGE,
  PROJECT_PLAN_RATIO_RANGE,
  SUBPHASE_PLAN_RATIO_RANGE,
} from "../../features/workflow-state/constants"

function collectMarkdown(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  const entries = readdirSync(root)
  for (const entry of entries) {
    const path = join(root, entry)
    const info = statSync(path)
    if (info.isDirectory()) {
      out.push(...collectMarkdown(path))
      continue
    }
    if (entry.toLowerCase().endsWith(".md")) out.push(path)
  }
  return out.sort((a, b) => a.localeCompare(b))
}

function dynamicRatio(total: number, min: number, max: number): number {
  if (total <= 4) return max
  if (total <= 10) return (min + max) / 2
  return min
}

function pickByRatio(files: string[], min: number, max: number): string[] {
  if (files.length === 0) return []
  const ratio = dynamicRatio(files.length, min, max)
  const count = Math.max(1, Math.ceil(files.length * ratio))
  return files.slice(0, Math.min(files.length, count))
}

function phaseProgressFiles(projectDir: string, currentPhase?: number): string[] {
  const root = join(projectDir, "docs", "phases")
  if (!existsSync(root)) return []

  const entries = readdirSync(root).filter((name) => /^phase_\d+$/.test(name)).sort((a, b) => a.localeCompare(b))
  const selected: string[] = []

  for (const entry of entries) {
    const value = Number(entry.replace("phase_", ""))
    if (Number.isNaN(value)) continue
    if (currentPhase !== undefined && value >= currentPhase) continue
    const file = join(root, entry, "PROGRESS.md")
    if (existsSync(file)) selected.push(file)
  }

  return selected
}

function currentPhaseSubprogressFiles(projectDir: string, currentPhase?: number, currentSubphase?: string): string[] {
  if (currentPhase === undefined) return []
  const root = join(projectDir, "docs", "phases", `phase_${currentPhase}`)
  if (!existsSync(root)) return []

  const subphaseLimit = (() => {
    if (!currentSubphase) return undefined
    const match = currentSubphase.match(/^(\d+)-(\d+)$/)
    if (!match) return undefined
    return Number(match[2])
  })()

  const entries = readdirSync(root)
    .filter((name) => /^\d+-\d+$/.test(name))
    .sort((a, b) => a.localeCompare(b))

  const selected: string[] = []
  for (const entry of entries) {
    const match = entry.match(/^(\d+)-(\d+)$/)
    if (!match) continue
    const sub = Number(match[2])
    if (subphaseLimit !== undefined && sub >= subphaseLimit) continue
    const file = join(root, entry, "PROGRESS.md")
    if (existsSync(file)) selected.push(file)
  }

  return selected
}

export function collectPlanFiles(input: {
  projectDir: string
  phase?: number
  subphase?: string
}): {
  files: string[]
  stats: {
    project: { selected: number; total: number }
    phase: { selected: number; total: number }
    subphase: { selected: number; total: number }
    phaseProgress: { selected: number; total: number }
    subphaseProgress: { selected: number; total: number }
  }
} {
  const projectPlanAll = collectMarkdown(join(input.projectDir, "docs", "plan"))
  const phasePlanAll =
    input.phase !== undefined
      ? collectMarkdown(join(input.projectDir, "docs", "phases", `phase_${input.phase}`, "plan"))
      : []
  const subphasePlanAll =
    input.phase !== undefined && input.subphase
      ? collectMarkdown(join(input.projectDir, "docs", "phases", `phase_${input.phase}`, input.subphase, "plan"))
      : []

  const projectPlan = pickByRatio(projectPlanAll, PROJECT_PLAN_RATIO_RANGE.min, PROJECT_PLAN_RATIO_RANGE.max)
  const phasePlan = pickByRatio(phasePlanAll, PHASE_PLAN_RATIO_RANGE.min, PHASE_PLAN_RATIO_RANGE.max)
  const subphasePlan = pickByRatio(subphasePlanAll, SUBPHASE_PLAN_RATIO_RANGE.min, SUBPHASE_PLAN_RATIO_RANGE.max)
  const phaseProgress = phaseProgressFiles(input.projectDir, input.phase)
  const subphaseProgress = currentPhaseSubprogressFiles(input.projectDir, input.phase, input.subphase)

  const files = [...new Set([...projectPlan, ...phasePlan, ...subphasePlan, ...phaseProgress, ...subphaseProgress])]
  return {
    files,
    stats: {
      project: { selected: projectPlan.length, total: projectPlanAll.length },
      phase: { selected: phasePlan.length, total: phasePlanAll.length },
      subphase: { selected: subphasePlan.length, total: subphasePlanAll.length },
      phaseProgress: { selected: phaseProgress.length, total: phaseProgress.length },
      subphaseProgress: { selected: subphaseProgress.length, total: subphaseProgress.length },
    },
  }
}

export function buildPlanContext(input: {
  projectDir: string
  phase?: number
  subphase?: string
}): { content: string; files: string[] } {
  const { files, stats } = collectPlanFiles(input)
  if (files.length === 0) {
    return { files: [], content: "" }
  }

  const relative = files.map((file) => file.replace(`${input.projectDir}/`, ""))

  const lines: string[] = [
    "## Crucible Auto Context Rehydration",
    "Before continuing, read the following plan/progress files with your read tool.",
    "",
    "Coverage target (as configured):",
    `- Project plan: ${stats.project.selected}/${stats.project.total} files (${Math.round((stats.project.selected / Math.max(1, stats.project.total)) * 100)}%) [target 30-50%]`,
    `- Current phase plan: ${stats.phase.selected}/${stats.phase.total} files (${Math.round((stats.phase.selected / Math.max(1, stats.phase.total)) * 100)}%) [target 80-100%]`,
    `- Current sub-phase plan: ${stats.subphase.selected}/${stats.subphase.total} files (${Math.round((stats.subphase.selected / Math.max(1, stats.subphase.total)) * 100)}%) [target 100%]`,
    `- Previous phase progress files: ${stats.phaseProgress.selected}`,
    `- Current phase prior sub-phase progress files: ${stats.subphaseProgress.selected}`,
    "",
    "### Required file reads",
    ...relative.map((path) => `- ${path}`),
    "",
    "Read all listed files now, then proceed with the user's request.",
  ]

  return { files, content: lines.join("\n") }
}
