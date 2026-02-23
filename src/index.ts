import type { Plugin } from "@opencode-ai/plugin"
import { join } from "node:path"

import { createWriteExistingFileGuardHook } from "./hooks/quality/write-existing-file-guard"
import { createThinkingBlockValidatorHook } from "./hooks/quality/thinking-block-validator"
import { createEmptyTaskResponseDetectorHook } from "./hooks/quality/empty-task-response-detector"
import { createEditErrorRecoveryHook } from "./hooks/recovery/edit-error-recovery"
import { createJsonErrorRecoveryHook } from "./hooks/recovery/json-error-recovery"

import { createContextWindowMonitorHook } from "./hooks/context-window-monitor"
import { createToolOutputTruncatorHook } from "./hooks/tool-output-truncator"
import { createHashlineReadEnhancerHook } from "./hooks/hashline-read-enhancer"
import { createHashlineEditDiffEnhancerHook } from "./hooks/hashline-edit-diff-enhancer"
import { createQuestionLabelTruncatorHook } from "./hooks/question-label-truncator"
import { createAnthropicEffortHook } from "./hooks/anthropic-effort"
import { createRulesInjectorHook } from "./hooks/rules-injector"
import { createDirectoryAgentsInjectorHook } from "./hooks/directory-agents-injector"
import { createDirectoryReadmeInjectorHook } from "./hooks/directory-readme-injector"
import { createSessionNotification } from "./hooks/session-notification"
import { createInteractiveBashSessionHook } from "./hooks/interactive-bash-session"
import { createAutoSlashCommandHook } from "./hooks/auto-slash-command"
import { createNonInteractiveEnvHook } from "./hooks/non-interactive-env"
import { createDelegateTaskRetryHook } from "./hooks/delegate-task-retry"
import { createAgentUsageReminderHook } from "./hooks/agent-usage-reminder"
import { createSessionRecoveryHook } from "./hooks/session-recovery"
import { createContextLimitRecoveryHook } from "./hooks/context-limit-recovery"

import { createGrepTools } from "./tools/grep"
import { createGlobTools } from "./tools/glob"
import { createAstGrepTools } from "./tools/ast-grep"
import {
  lsp_diagnostics,
  lsp_find_references,
  lsp_goto_definition,
  lsp_prepare_rename,
  lsp_rename,
  lsp_symbols,
} from "./tools/lsp"
import { createHashlineEditTool } from "./tools/hashline-edit"
import { createLookAt } from "./tools/look-at"
import { createSessionManagerTools } from "./tools/session-manager"
import { interactive_bash } from "./tools/interactive-bash"
import { createSkillTool } from "./tools/skill"
import { createSkillMcpTool } from "./tools/skill-mcp"
import { createSlashcommandTool, discoverCommandsSync } from "./tools/slashcommand"
import type { CommandInfo } from "./tools/slashcommand"
import { createTaskTool } from "./tools/task"
import { createAgentInvokeTool } from "./tools/agent-invoke"
import { createBackgroundCancelTool, createBackgroundOutputTool } from "./tools/background-task"
import { createSpecialCompactTool } from "./tools/special-compact"

import { discoverAllSkills, type LoadedSkill } from "./features/opencode-skill-loader"
import { SkillMcpManager } from "./features/skill-mcp-manager"
import {
  contextCollector,
  createContextInjectorHook,
  createContextInjectorMessagesTransformHook,
} from "./features/context-injector"
import { BackgroundManager } from "./features/background-agent"
import { WorkflowStateManager } from "./features/workflow-state"
import { defaults } from "./config/defaults"
import { compileTemplates, expandTemplatesInSystem } from "./templates"
import { createCompactionTodoPreserverHook } from "./hooks/compaction-todo-preserver"
import { createWorkflowContextHook } from "./hooks/workflow-context"
import { loadMcpConfigs } from "./features/claude-code-mcp-loader"

const CruciblePlugin: Plugin = async (ctx) => {
  const hashlineConfig = { hashline_edit: { enabled: true } }
  const templates = compileTemplates(join(import.meta.dir, "templates"))
  if (templates.size === 0) {
    throw new Error("No templates discovered in src/templates")
  }

  const workflow = new WorkflowStateManager(ctx.directory)
  const backgroundManager = new BackgroundManager(ctx)
  const skillMcpManager = new SkillMcpManager()
  const commands: CommandInfo[] = discoverCommandsSync(ctx.directory)
  let loadedSkills: LoadedSkill[] = []
  try {
    loadedSkills = await discoverAllSkills(ctx.directory)
  } catch {
    loadedSkills = []
  }

  const getSessionIDForMcp = (): string => "crucible-main"

  const writeExistingFileGuard = createWriteExistingFileGuardHook(ctx)
  const thinkingBlockValidator = createThinkingBlockValidatorHook()
  const emptyTaskResponseDetector = createEmptyTaskResponseDetectorHook(ctx)
  const editErrorRecovery = createEditErrorRecoveryHook(ctx)
  const jsonErrorRecovery = createJsonErrorRecoveryHook(ctx)
  const contextWindowMonitor = createContextWindowMonitorHook(ctx)
  const toolOutputTruncator = createToolOutputTruncatorHook(ctx)
  const hashlineReadEnhancer = createHashlineReadEnhancerHook(ctx, hashlineConfig)
  const hashlineEditDiffEnhancer = createHashlineEditDiffEnhancerHook(hashlineConfig)
  const questionLabelTruncator = createQuestionLabelTruncatorHook()
  const anthropicEffort = createAnthropicEffortHook()
  const rulesInjector = createRulesInjectorHook(ctx)
  const directoryAgentsInjector = createDirectoryAgentsInjectorHook(ctx)
  const directoryReadmeInjector = createDirectoryReadmeInjectorHook(ctx)
  const sessionNotification = createSessionNotification(ctx)
  const interactiveBashSession = createInteractiveBashSessionHook(ctx)
  const autoSlashCommand = createAutoSlashCommandHook({ skills: loadedSkills })
  const nonInteractiveEnv = createNonInteractiveEnvHook(ctx)
  const contextInjectorChat = createContextInjectorHook(contextCollector)
  const contextInjectorTransform = createContextInjectorMessagesTransformHook(contextCollector)
  const delegateTaskRetry = createDelegateTaskRetryHook(ctx)
  const agentUsageReminder = createAgentUsageReminderHook(ctx)
  const sessionRecovery = createSessionRecoveryHook(ctx)
  const contextLimitRecovery = createContextLimitRecoveryHook(ctx)
  const todoPreserver = createCompactionTodoPreserverHook(ctx)
  const workflowContext = createWorkflowContextHook({
    ctx,
    workflow,
    background: backgroundManager,
    todoPreserver,
  })

  const taskTool = createTaskTool(ctx, backgroundManager)
  const agentInvokeTool = createAgentInvokeTool(ctx, backgroundManager)
  const backgroundOutputTool = createBackgroundOutputTool(backgroundManager)
  const backgroundCancelTool = createBackgroundCancelTool(backgroundManager)
  const specialCompactTool = createSpecialCompactTool(ctx)

  const commandMap = commands.reduce<Record<string, { template: string; description?: string; agent?: string; model?: string; subtask?: boolean }>>((acc, command) => {
    if (!command.content) return acc
    acc[command.name] = {
      template: command.content,
      description: command.metadata.description,
      agent: command.metadata.agent,
      model: command.metadata.model,
      subtask: command.metadata.subtask,
    }
    return acc
  }, {})

  const skillTool = createSkillTool({
    commands,
    skills: loadedSkills,
    mcpManager: skillMcpManager,
    getSessionID: getSessionIDForMcp,
    gitMasterConfig: {
      commit_footer: false,
      include_co_authored_by: false,
    },
  })

  const slashcommandTool = createSlashcommandTool({
    commands,
    skills: loadedSkills,
    mcpManager: skillMcpManager,
    getSessionID: getSessionIDForMcp,
    gitMasterConfig: {
      commit_footer: false,
      include_co_authored_by: false,
    },
  })

  const skillMcpTool = createSkillMcpTool({
    manager: skillMcpManager,
    getLoadedSkills: () => loadedSkills,
    getSessionID: getSessionIDForMcp,
  })

  return {
    tool: {
      ...createGrepTools(ctx),
      ...createGlobTools(ctx),
      ...createAstGrepTools(ctx),
      ...createSessionManagerTools(ctx),

      lsp_goto_definition,
      lsp_find_references,
      lsp_symbols,
      lsp_diagnostics,
      lsp_prepare_rename,
      lsp_rename,

      edit: createHashlineEditTool(),
      look_at: createLookAt(ctx),
      interactive_bash,
      skill: skillTool,
      skill_mcp: skillMcpTool,
      slashcommand: slashcommandTool,
      task: taskTool,
      agent_invoke: agentInvokeTool,
      call_omo_agent: agentInvokeTool,
      background_output: backgroundOutputTool,
      background_cancel: backgroundCancelTool,
      special_compact: specialCompactTool,
    },

    "chat.message": async (input, output) => {
      await autoSlashCommand["chat.message"]?.(input, output)
      await workflowContext["chat.message"]?.(input, output)
      await contextInjectorChat["chat.message"]?.(input, output)
    },

    "chat.params": async (input, output) => {
      await anthropicEffort["chat.params"]?.(input, output)
    },

    "command.execute.before": async (input, output) => {
      await autoSlashCommand["command.execute.before"]?.(input, output)
      await workflowContext["command.execute.before"]?.(input, output)
    },

    config: async (input) => {
      input.command = {
        ...(input.command ?? {}),
        ...commandMap,
      }

      const loaded = await loadMcpConfigs([])
      input.mcp = {
        ...(input.mcp ?? {}),
        ...loaded.servers,
      }
    },

    "tool.execute.before": async (input, output) => {
      await writeExistingFileGuard["tool.execute.before"]?.(input, output)
      await questionLabelTruncator["tool.execute.before"]?.(input, output)
      await nonInteractiveEnv["tool.execute.before"]?.(input, output)
      await hashlineEditDiffEnhancer["tool.execute.before"]?.(input, output)
      await rulesInjector["tool.execute.before"]?.(input, output)
      await directoryAgentsInjector["tool.execute.before"]?.(input, output)
      await directoryReadmeInjector["tool.execute.before"]?.(input, output)
    },

    "tool.execute.after": async (input, output) => {
      await toolOutputTruncator["tool.execute.after"]?.(input, output)
      await editErrorRecovery["tool.execute.after"]?.(input, output)
      await jsonErrorRecovery["tool.execute.after"]?.(input, output)
      await emptyTaskResponseDetector["tool.execute.after"]?.(input, output)
      await hashlineReadEnhancer["tool.execute.after"]?.(input, output)
      await hashlineEditDiffEnhancer["tool.execute.after"]?.(input, output)
      await contextWindowMonitor["tool.execute.after"]?.(input, output)
      await rulesInjector["tool.execute.after"]?.(input, output)
      await directoryAgentsInjector["tool.execute.after"]?.(input, output)
      await directoryReadmeInjector["tool.execute.after"]?.(input, output)
      await interactiveBashSession["tool.execute.after"]?.(input, output)
      await delegateTaskRetry["tool.execute.after"]?.(input, output)
      await agentUsageReminder["tool.execute.after"]?.(input, output)
      await workflowContext["tool.execute.after"]?.(input, output)
    },

    event: async ({ event }) => {
      backgroundManager.handleEvent(event)
      await workflowContext.event?.({ event })
      await contextWindowMonitor.event?.({ event })
      await rulesInjector.event?.({ event })
      await directoryAgentsInjector.event?.({ event })
      await directoryReadmeInjector.event?.({ event })
      await sessionNotification?.({ event })
      await interactiveBashSession.event?.({ event })
      await sessionRecovery.event?.({ event })
      await contextLimitRecovery.event?.({ event })
    },

    "experimental.chat.messages.transform": async (input, output) => {
      await contextInjectorTransform["experimental.chat.messages.transform"]?.(input, output)
      await thinkingBlockValidator["experimental.chat.messages.transform"]?.(input, output)
    },

    "experimental.chat.system.transform": async (_input, output) => {
      output.system = expandTemplatesInSystem(output.system, templates)
    },

    "experimental.session.compacting": async (input, output) => {
      await workflowContext["experimental.session.compacting"]?.(input, output)
    },
  }
}

export default CruciblePlugin
