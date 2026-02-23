export const defaults = {
  agents: {
    builder: { model: "openai/gpt-5.3-codex" },
    architect: { model: "anthropic/claude-opus-4-6" },
    reviewer: { model: "anthropic/claude-opus-4-6" },
    oracle: { model: "anthropic/claude-opus-4-6" },
    researcher: { model: "anthropic/claude-opus-4-6" },
    scout: { model: "anthropic/claude-sonnet-4-6" },
    librarian: { model: "anthropic/claude-sonnet-4-6" },
  },
  context: {
    monitorThreshold: 0.7,
    truncation: {
      defaultMaxTokens: 50000,
      webfetchMaxTokens: 10000,
    },
  },
  workflow: {
    planDir: "docs/plan",
    phasesDir: "docs/phases",
    researchDir: "docs/research",
    progressFile: "PROGRESS.md",
  },
  templates: {
    dir: "src/templates",
  },
  review: {
    outputDir: "reviews",
  },
} as const

export type CrucibleDefaults = typeof defaults
