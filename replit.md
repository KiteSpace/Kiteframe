# Kiteframe Workflow Editor

## Overview
Kiteframe is a visual workflow editor for creating and managing interactive diagrams with various node types. It features a modern UI with drag-and-drop functionality, real-time canvas interactions, and AI integration for workflow processing and generation. The project aims to provide core workflow editing capabilities with advanced features delivered through a plugin architecture. Its core canvas library has been extracted into an open-source npm package, Kiteline (`@kiteline/core`). Kiteframe integrates with KitelineAI, a privacy-focused Ollama service for AI workflow generation.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Service Architecture
- **Kiteframe**: Main visual workflow editor web application.
- **Kiteline Library (`@kiteline/core`)**: Standalone open-source npm package for the core canvas library.
- **KitelineAI**: Dedicated Ollama service for privacy-focused AI processing.

### Frontend Architecture (Kiteframe)
- **Framework**: React 18 with TypeScript and Vite.
- **UI Components**: Radix UI primitives with shadcn/ui.
- **Styling**: Tailwind CSS.
- **State Management**: React hooks, TanStack Query.
- **Canvas System**: Custom KiteFrame library.
- **Routing**: Wouter.

### Backend Architecture (Kiteframe)
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript.
- **API Structure**: RESTful API.
- **Storage Interface**: Pluggable storage system.

### AI Service Architecture (KitelineAI)
- **Runtime**: Ollama on Replit Autoscale.
- **Models**: Optimized for fast startup (Gemma2 2B, Llama 3.2 3B).
- **API**: OpenAI-compatible endpoints.
- **Privacy**: Data processed but not stored.

### Data Storage
- **Database ORM**: Drizzle ORM for PostgreSQL.
- **Schema Management**: Drizzle Kit for migrations.
- **Session Management**: PostgreSQL session store.

### Authentication and Authorization
- **Multi-Provider OAuth**: Google, GitHub, Replit.
- **Account Linking**: Links multiple OAuth providers by email.
- **Session Storage**: PostgreSQL-backed sessions with Passport.js.
- **Firebase-Backend Sync**: Frontend Firebase auth syncs to backend Passport sessions for cloud project access.

### Subscription System (KiteAI)
- **Tiered Model**: Free, Advanced, Pro tiers with credit allocations.
- **Stripe Integration**: Checkout, Customer Portal, webhooks.

### Canvas and Workflow System
- **Node Types**: Input, process, condition, output, AI, experiment, image nodes.
- **Edge Management**: Properties, validation, templates.
- **Interactive Features**: Drag-and-drop, zoom/pan, multi-node selection, context menus, keyboard shortcuts, minimap, toolbar.
- **Auto-Layout**: Five layout options (Horizontal Flow, Vertical Flow, Grid, Circular, Hierarchical).
- **Workflow Generation**: AI-generated workflows from text prompts and image analysis.
- **Image Analysis**: Upload and analyze diagrams (PNG, JPG, GIF) to convert into interactive workflows.
- **Figma Import**: Import Figma designs as interactive image nodes.

### Experiment Node System
- **Purpose**: AI-powered speculative branch authoring for "what-if" scenarios and enhancements.
- **Modes**: Whatif, enhancement, open_exploration.
- **Speculative Preview**: Generated branches marked with `meta.speculative=true`, styled with dashed edges, excluded from exports.
- **SpaceProbe**: Intelligent layout positioning with collision detection.
- **ExperimentBranchHeader**: Purple overlay with Accept/Reject buttons.
- **Edit-After-Accept**: Popover for regenerating experiments on accepted process nodes.

### Insights System
- **Philosophy**: Canvas is judgment-free; diagnostics are opt-in via "Test Flight".
- **No Auto-Run**: Insights generated only on user action.
- **Insight Type**: Unified `Insight` model.
- **Insight Actions**: Explore (creates Experiment node), Defer, Add to PRD.
- **Interactions**: Hovering highlights nodes, clicking pans canvas.
- **No System-Initiated Experiments**: Requires explicit user action.

### Project Panel
- **Tabs**: KiteAI (AI assistant), Project (unified document), Layers (canvas hierarchy), Notes, Insights.
- **Persistence**: Collapsible panel and active tab state persisted in localStorage.

### PRD System (Project Tab)
- **AI-Powered PRD Generation**: Generates Product Requirement Documents from workflow semantic models.
- **Stale Detection**: Identifies workflow changes since last PRD generation.
- **Manual Edit Preservation**: Preserves manual edits during regeneration.
- **Backup System**: Automatic backup before regeneration.

### AI Integration Layer
- **Client Interface**: OpenAI-compatible API client.
- **Provider System**: React context-based AI provider supporting OpenAI (GPT-4o) and Ollama models.
- **Privacy Tiers**: UI options for "Maximum Privacy" (Ollama) and "Standard Privacy" (OpenAI, Anthropic).
- **Image-to-Workflow Generation**: AI analysis of diagrams for conversion.

### Unified Vision Pipeline
- **Purpose**: Routes all input types (text, image, Figma) through a consistent PM conversation flow with actionability scoring.
- **VisionExtractedSignals**: Captures `flowsDetected`, `branching`, `screensDetected`, `primaryCTA`, `decisionPoints`, `entryPoints`.
- **computeActionabilityWithVision()**: Enhances base actionability score with vision signals.

### PM Depth Guards
- **Purpose**: Enforces PM-level reasoning depth, blocking workflows lacking meaningful product decisions.
- **Detection Functions**: `detectTradeoff()`, `detectRisk()`, `detectIrreversible()`, `detectNonRetryBranches()`.
- **Gate Condition**: Requires AT LEAST ONE of: tradeoff, risk, irreversible action, or meaningful branching.
- **Role Context**: Applies when `role === 'pm'` or `hybrid` with high confidence.
- **System Prompt**: Requires 5 proof obligations (WHO, GOAL, DECISIONS 3+, TRADEOFF 1+, FAILURE MODE 1+).

### Explainability, Auditability & Trust
- **Philosophy**: All additions are optional, read-only, and non-blocking.
- **Provenance Metadata**: NodeMeta and EdgeMeta include `createdFromInsightId`, `createdFromProposalId`, `createdFromExperimentId`, `createdAt`.
- **Decision Snapshots**: Structured capture of heuristics, scope rules, variant choice, session context, uncertainty, validation, semantic claims, and mismatches.
- **Structural Timeline**: Tracks Accept/Undo/Redo events (session-scoped).
- **Audit Export**: `generateAuditExport()` produces JSON with workflow structure, provenance, snapshots, timeline.
- **Why Inspector**: `WhyInspector.tsx` provides read-only popover showing "why this node exists" with insight linkage, heuristics, semantic claims, and structural gaps.
- **Enterprise Guardrails**: Config-level hooks (`aiActionsDisabled`, `readOnlyMode`, `auditOnlyAccess`).

### Semantic Completeness Enforcement
- **Purpose**: Detects when AI-generated workflows describe stateful behavior (retries, thresholds, escalation) but lack structural encoding.
- **Philosophy**: Read-only detection by default; enforcement requires explicit feature flag.
- **Semantic Claims**: Types include `repeated_failure`, `retry_with_limit`, `threshold_escalation`, etc.
- **Claim Extraction**: Pattern-based detection from node labels, descriptions, and insight text.
- **Structural Analysis**: Detects decision nodes, loops, escalation paths.
- **Mismatch Detection**: Compares claims to structure, surfacing gaps as warnings.
- **Feature Flag**: `VITE_ENABLE_SEMANTIC_ENFORCEMENT` enables blocking for high-confidence mismatches.

### Merge vs Branch Intent Heuristic
- **Purpose**: Detect whether users want to modify existing workflows (merge) or create new variants (branch).
- **Philosophy**: Passive detection only (no UI prompts, no blocking). Ambiguous intent defaults to MERGE.
- **Detection**: Pattern matching for merge signals (tighten, simplify, fix) and branch signals (alternative, compare, version 2).
- **MergeBranchDecision**: Captures `intent`, `confidence`, `resolvedIntent`, `detectedSignals`.
- **Integration Point**: Invoked ONLY in chat workflow generation (`KiteAIChat.tsx`).
- **Persistence**: Decision flows from detection → WorkflowDraft → CaptureProposalDecisionParams → DecisionSnapshot → WhyInspector.
- **Audit Visibility**: WhyInspector displays decision read-only with GitMerge/GitBranch indicators.
- **Feature Flag**: `ai.mergeBranchHeuristic` (default ON).

### Decision Repair Heuristic
- **Purpose**: Auto-repair incomplete decision nodes (missing Yes/No branches, unlabeled edges, dangling outcomes) BEFORE suggestions.
- **Philosophy**: REPAIR mechanism, not exploration. Fixes logic errors, merge mode only.
- **Hard Guarantees**: Never creates parallel workflows, never deletes user-created nodes, never invents business semantics, idempotent.
- **Decision Completeness**: Defined by outgoing edges, semantic labels, valid targets, and coverage of outcomes.
- **Issue Types**: `MISSING_OUTCOME`, `UNLABELED_EDGES`, `DANGLING_EDGE`.
- **Edge Label Enforcement**: Auto-assigns "Yes"/"No" or "Option A/B/C".
- **Repair Strategy**: Add missing outcomes, route dangling edges to existing or new minimal "Exit Flow" node.
- **Execution Timing**: Runs after generation, before Test Flight, Propose/Experiment.
- **Audit Visibility**: `DecisionRepairApplied` in DecisionSnapshot and node.data.meta. WhyInspector shows repair actions.
- **Feature Flag**: `ai.decisionRepair` (default ON).

### GPT-5 Migration Foundation
- **Central AI Router**: All AI calls route through `client/src/ai/router/aiRouter.ts` with task-type based model selection.
- **Task-Type Model Policy**: Defined in `types.ts` - GPT-5.1 for workflow_reasoning/experiments/prd_generation, GPT-4o for vision_ingestion, user-selected for general_chat.
- **Session Model Lock**: Model/provider locked at session start using `sessionLock.ts`. SessionIds stored in refs (proposalSessionIdRef, experimentSessionIdRef), cleared on Accept/Cancel.
- **Model Provenance**: `ModelProvenance` interface captures `providerUsed`, `modelUsed`, `routerTaskType`, `usedFallback`, `fallbackModelUsed`, `sessionId`.
- **Retry & Fallback**: Max 1 retry with same model, then fallback GPT-5.1 → GPT-4o.
- **Tolerant JSON Parser**: `jsonParser.ts` extracts JSON from fenced code blocks, validates with Zod.
- **Feature Flag**: `VITE_ENABLE_GPT5_WORKFLOW_REASONING` enables GPT-5.1.
- **Structured Logging**: Router logs all requests for observability.
- **routerAiClient Wrapper**: Adapts `getRouter()` to legacy `AiClient` interface for backwards compatibility with existing hooks.

### Loop Detection System
- **Purpose**: Detect retry patterns lacking exit conditions or counters, surfacing potential infinite loop risks.
- **Detection Types**: `loop_without_exit`, `retry_without_counter`, `infinite_loop_risk`.
- **Implementation**: `client/src/ai/analysis/loopDetection.ts` with cycle detection, self-loop detection, retry pattern analysis, semantic exit condition checking.
- **Integration**: Surfaced via Test Flight diagnostics as `retry-without-counter` diagnostic type.
- **Feature Flag**: `VITE_ENABLE_LOOP_DETECTION_WARNINGS` (default ON).
- **Graph Filtering**: Uses speculative-filtered graph to avoid noise from AI-generated preview branches.

### Plugin Architecture
- **KiteFrameCore**: Plugin management system with `PluginProvider`, hooks, and event system.
- **Extension Points**: 8 defined extension points for canvas interactions.

### Enterprise Security & Stability Features
- **Security**: Input validation, text sanitization (XSS), Zod schema validation.
- **Error Boundaries**: Robust error handling with component isolation.
- **Undo/Redo System**: Command pattern implementation with batching.
- **Performance Optimization**: `React.memo`, `useCallback`, `useMemo`.

### Kiteline Library Package (@kiteline/core)
- **Overview**: Standalone open-source npm package of the core canvas library.
- **Distribution**: TypeScript source files, MIT License.
- **Documentation**: Comprehensive `README.md`, `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`.
- **Demo Website**: Interactive demo at `/demo` route.

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React 18, React DOM, TanStack Query.
- **Build Tools**: Vite, TypeScript, ESBuild.

### UI and Styling
- **Component Library**: Radix UI primitives.
- **Styling**: Tailwind CSS, PostCSS.
- **Icons**: Font Awesome.

### Database and ORM
- **Database**: PostgreSQL (via Neon).
- **ORM**: Drizzle ORM.
- **Validation**: Zod.

### AI and External Services
- **AI Client**: OpenAI-compatible HTTP client.
- **Ollama**: For local and remote AI model serving.
- **OpenAI**: Cloud-based AI services.
- **Anthropic**: Supported AI provider option.