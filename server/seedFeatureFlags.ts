import { featureFlagService } from "./featureFlagService";

const INITIAL_FLAGS = [
  // AI Workflow Intelligence
  { key: 'ai.workflowGeneration', name: 'Workflow Generation', description: 'Text-to-workflow generation', category: 'ai', status: 'ga', defaultEnabled: true },
  { key: 'ai.imageAnalysis', name: 'Image Analysis', description: 'Upload diagram → interactive workflow', category: 'ai', status: 'ga', defaultEnabled: true },
  { key: 'ai.edgeCaseExpansion', name: 'Edge Case Expansion', description: 'Automatic what-if branch suggestions', category: 'ai', status: 'beta', defaultEnabled: false },
  { key: 'ai.followUpPrompts', name: 'Follow-up Prompts', description: 'Suggested follow-up questions', category: 'ai', status: 'ga', defaultEnabled: true },
  { key: 'ai.insightsSurfacing', name: 'Insights Surfacing', description: 'Test Flight diagnostics in Insights tab', category: 'ai', status: 'ga', defaultEnabled: true },
  { key: 'ai.prdGeneration', name: 'PRD Generation', description: 'AI-powered PRD from workflow', category: 'ai', status: 'ga', defaultEnabled: true },
  { key: 'ai.gpt5Routing', name: 'GPT-5 Routing', description: 'Enable GPT-5.1 for workflow reasoning', category: 'ai', status: 'beta', defaultEnabled: false },
  { key: 'ai.ollamaProvider', name: 'Ollama Provider', description: 'Enable Ollama/KitelineAI provider', category: 'ai', status: 'beta', defaultEnabled: false },
  { key: 'ai.semanticEnforcement', name: 'Semantic Enforcement', description: 'Detect claim/structure mismatches', category: 'ai', status: 'beta', defaultEnabled: false },
  
  // Phase 7: Unified Conversation Engine
  { key: 'ai.unifiedConversationEngine', name: 'Unified Conversation Engine', description: 'Use useKiteAIConversation across all chat surfaces', category: 'ai', status: 'ga', defaultEnabled: true },
  { key: 'ai.pmDepthGuardsChat', name: 'PM Depth Guards (Chat)', description: 'PM depth guards in chat - warn/log only when OFF', category: 'ai', status: 'beta', defaultEnabled: false },
  { key: 'ai.clarificationLoopsChat', name: 'Clarification Loops (Chat)', description: 'Auto-trigger clarification loops in chat', category: 'ai', status: 'beta', defaultEnabled: false },
  
  // Phase 6.5: Merge vs Branch Intent Detection
  { key: 'ai.mergeBranchHeuristic', name: 'Merge/Branch Heuristic', description: 'Detect whether to modify existing workflow or create new', category: 'ai', status: 'ga', defaultEnabled: true },
  
  // Phase 6.7: Decision Repair Heuristic
  { key: 'ai.decisionRepair', name: 'Decision Repair', description: 'Auto-repair incomplete decision nodes (missing branches, unlabeled edges)', category: 'ai', status: 'ga', defaultEnabled: true },

  // Canvas & Editing
  { key: 'canvas.autoLayout', name: 'Auto Layout', description: '5 layout algorithms (horizontal, grid, etc.)', category: 'canvas', status: 'ga', defaultEnabled: true },
  { key: 'canvas.minimap', name: 'Minimap', description: 'Navigation minimap overlay', category: 'canvas', status: 'ga', defaultEnabled: true },
  { key: 'canvas.multiSelect', name: 'Multi-Select', description: 'Select/edit multiple nodes', category: 'canvas', status: 'ga', defaultEnabled: true },
  { key: 'canvas.experimentNodes', name: 'Experiment Nodes', description: 'Speculative branch authoring', category: 'canvas', status: 'beta', defaultEnabled: false },
  { key: 'canvas.smartGuides', name: 'Smart Guides', description: 'Snap & alignment guides', category: 'canvas', status: 'ga', defaultEnabled: true },
  { key: 'canvas.undoRedo', name: 'Undo/Redo', description: 'History with batching', category: 'canvas', status: 'ga', defaultEnabled: true },
  { key: 'canvas.zoomPan', name: 'Zoom & Pan', description: 'Zoom controls and pan gestures', category: 'canvas', status: 'ga', defaultEnabled: true },

  // Chat & Collaboration
  { key: 'chat.fullscreenMode', name: 'Fullscreen Chat', description: 'Fullscreen chat shell', category: 'chat', status: 'ga', defaultEnabled: true },
  { key: 'chat.panelMode', name: 'Panel Chat', description: 'Side panel chat', category: 'chat', status: 'ga', defaultEnabled: true },
  { key: 'chat.discussionView', name: 'Discussion View', description: 'Node-linked discussion threads', category: 'chat', status: 'beta', defaultEnabled: false },
  { key: 'chat.workflowProposals', name: 'Workflow Proposals', description: 'Rendered workflow proposal cards', category: 'chat', status: 'ga', defaultEnabled: true },
  { key: 'chat.attachments', name: 'Attachments', description: 'Image/file attachments in chat', category: 'chat', status: 'ga', defaultEnabled: true },
  { key: 'chat.smartScroll', name: 'Smart Scroll', description: 'Auto-scroll + "New messages" indicator', category: 'chat', status: 'ga', defaultEnabled: true },

  // Enterprise Governance
  { key: 'enterprise.auditExport', name: 'Audit Export', description: 'JSON export with provenance + timeline', category: 'enterprise', status: 'beta', defaultEnabled: false },
  { key: 'enterprise.whyInspector', name: 'Why Inspector', description: 'Read-only "why this node exists" popover', category: 'enterprise', status: 'beta', defaultEnabled: false },
  { key: 'enterprise.pmDepthGuards', name: 'PM Depth Guards', description: 'Block shallow workflows in PM mode', category: 'enterprise', status: 'beta', defaultEnabled: false },
  { key: 'enterprise.readOnlyMode', name: 'Read-Only Mode', description: 'View-only access for auditors', category: 'enterprise', status: 'beta', defaultEnabled: false },
  { key: 'enterprise.diagnosticsLogging', name: 'Diagnostics Logging', description: 'Detailed runtime logging', category: 'enterprise', status: 'beta', defaultEnabled: false },

  // External Integrations
  { key: 'integrations.figmaImport', name: 'Figma Import', description: 'Import Figma designs as image nodes', category: 'integrations', status: 'ga', defaultEnabled: true },
  { key: 'integrations.stripeCredits', name: 'Stripe Credits', description: 'KiteAI credit gating via Stripe', category: 'integrations', status: 'ga', defaultEnabled: true },
  { key: 'integrations.firebaseSync', name: 'Firebase Sync', description: 'Firebase → backend session sync', category: 'integrations', status: 'ga', defaultEnabled: true },
] as const;

const INITIAL_GROUPS = [
  { name: 'Beta Testers', description: 'Early access to new features', color: '#8b5cf6' },
  { name: 'Enterprise', description: 'Enterprise tier customers', color: '#059669' },
  { name: 'Internal', description: 'Internal team members', color: '#dc2626' },
  { name: 'Free Tier', description: 'Free tier users', color: '#6b7280', isDefault: true },
] as const;

export async function seedFeatureFlags() {
  console.log('🚀 Seeding feature flags...');

  for (const flag of INITIAL_FLAGS) {
    try {
      const existing = await featureFlagService.getFlag(flag.key);
      if (!existing) {
        await featureFlagService.createFlag({
          key: flag.key,
          name: flag.name,
          description: flag.description,
          category: flag.category,
          status: flag.status,
          defaultEnabled: flag.defaultEnabled,
        });
        console.log(`  ✓ Created flag: ${flag.key}`);
      } else {
        console.log(`  - Flag exists: ${flag.key}`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to create flag ${flag.key}:`, error);
    }
  }

  console.log('🚀 Seeding feature groups...');

  for (const group of INITIAL_GROUPS) {
    try {
      const existing = await featureFlagService.getGroupByName(group.name);
      if (!existing) {
        await featureFlagService.createGroup({
          name: group.name,
          description: group.description,
          color: group.color,
          isDefault: 'isDefault' in group ? group.isDefault : false,
        });
        console.log(`  ✓ Created group: ${group.name}`);
      } else {
        console.log(`  - Group exists: ${group.name}`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to create group ${group.name}:`, error);
    }
  }

  console.log('✅ Feature flag seeding complete!');
}
