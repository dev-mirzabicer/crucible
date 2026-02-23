import type { ParsedPosition } from "./types"

function toSubphase(phase: number, sub: number): string {
  return `${phase}-${sub}`
}

export function parsePosition(text: string): ParsedPosition {
  const input = text.toLowerCase()

  const subphaseMatch = input.match(/(?:sub\s*phase|phase|implement)\s*(\d+)[.-](\d+)/i)
  if (subphaseMatch) {
    const phase = Number(subphaseMatch[1])
    const sub = Number(subphaseMatch[2])
    if (Number.isFinite(phase) && Number.isFinite(sub)) {
      return { phase, subphase: toSubphase(phase, sub) }
    }
  }

  const phaseMatch = input.match(/phase\s*(\d+)/i)
  if (phaseMatch) {
    const phase = Number(phaseMatch[1])
    if (Number.isFinite(phase)) {
      return { phase }
    }
  }

  return {}
}
