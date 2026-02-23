import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { basename, extname, join, resolve } from "node:path"

const TOKEN = /\{\{\s*([a-zA-Z0-9._-]+)\s*\}\}/g
const MAX_DEPTH = 3

function listMarkdownFiles(root: string): string[] {
  if (!existsSync(root)) return []
  const entries = readdirSync(root)
  const files: string[] = []
  for (const entry of entries) {
    const full = join(root, entry)
    const info = statSync(full)
    if (info.isDirectory()) {
      files.push(...listMarkdownFiles(full))
      continue
    }
    if (extname(entry).toLowerCase() === ".md") {
      files.push(full)
    }
  }
  return files
}

function readRawTemplates(root: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const file of listMarkdownFiles(root)) {
    const name = basename(file, ".md")
    map.set(name, readFileSync(file, "utf-8"))
  }
  return map
}

function resolveTemplate(
  name: string,
  raw: Map<string, string>,
  resolved: Map<string, string>,
  stack: string[],
): string {
  const cached = resolved.get(name)
  if (cached !== undefined) return cached
  const source = raw.get(name)
  if (source === undefined) {
    throw new Error(`Template not found: ${name}`)
  }
  if (stack.includes(name)) {
    throw new Error(`Template cycle detected: ${[...stack, name].join(" -> ")}`)
  }
  if (stack.length >= MAX_DEPTH) {
    throw new Error(`Template nesting exceeded max depth ${MAX_DEPTH}: ${[...stack, name].join(" -> ")}`)
  }

  let text = source
  TOKEN.lastIndex = 0
  let match = TOKEN.exec(source)
  while (match) {
    const key = match[1]
    const value = resolveTemplate(key, raw, resolved, [...stack, name])
    text = text.replaceAll(match[0], value)
    match = TOKEN.exec(source)
  }

  resolved.set(name, text)
  return text
}

export function compileTemplates(rootDir: string): Map<string, string> {
  const root = resolve(rootDir)
  const raw = readRawTemplates(root)
  const out = new Map<string, string>()
  for (const name of raw.keys()) {
    resolveTemplate(name, raw, out, [])
  }
  return out
}

export function expandTemplatesInText(text: string, templates: Map<string, string>): string {
  let out = text
  TOKEN.lastIndex = 0
  const matches = [...text.matchAll(TOKEN)]
  for (const match of matches) {
    const key = match[1]
    const value = templates.get(key)
    if (value === undefined) {
      throw new Error(`Unknown template token: ${match[0]}`)
    }
    out = out.replaceAll(match[0], value)
  }
  return out
}

export function expandTemplatesInSystem(system: string[], templates: Map<string, string>): string[] {
  return system.map((part) => expandTemplatesInText(part, templates))
}
