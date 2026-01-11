# Kiteframe Workflow Editor

## Overview
Kiteframe is a visual workflow editor for creating and managing interactive diagrams with various node types. It offers a modern UI with drag-and-drop functionality, real-time canvas interactions, and AI integration for workflow processing and generation. The project aims to deliver core workflow editing capabilities with advanced features via a plugin architecture. Its core canvas library, Kiteline (`@kiteline/core`), is an open-source npm package. Kiteframe integrates with KitelineAI, a privacy-focused Ollama service for AI workflow generation, and supports AI-powered PRD generation, image-to-workflow conversion, and experiment node systems for speculative branching.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Service Architecture
- **Kiteframe**: Main visual workflow editor web application.
- **Kiteline Library (`@kiteline/core`)**: Standalone open-source npm package for the core canvas library.
- **KitelineAI**: Dedicated Ollama service for privacy-focused AI processing.

### Frontend Architecture
- **Framework**: React 18, TypeScript, Vite.
- **UI**: Radix UI with shadcn/ui, Tailwind CSS.
- **Canvas**: Custom KiteFrame library.
- **State Management**: React hooks, TanStack Query.

### Backend Architecture
- **Runtime**: Node.js with Express.js (TypeScript).
- **API**: RESTful API.
- **Storage**: Pluggable storage system.

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
- **Model**: Tiered (Free, Advanced, Pro) with credit allocations.
- **Integration**: Stripe for checkout, customer portal, webhooks.

### Canvas and Workflow System
- **Node Types**: Input, process, condition, output, AI, experiment, image.
- **Interactive Features**: Drag-and-drop, zoom/pan, multi-node selection, context menus, keyboard shortcuts, minimap, toolbar.
- **Auto-Layout**: Five layout options (Horizontal Flow, Vertical Flow, Grid, Circular, Hierarchical).
- **Workflow Generation**: AI-generated workflows from text prompts and image analysis.
- **Image/Figma Import**: Analyze diagrams (PNG, JPG, GIF) or import Figma designs to convert into interactive workflows/image nodes.

### Experiment Node System
- **Purpose**: AI-powered speculative branch authoring for "what-if" scenarios.
- **Features**: Whatif, enhancement, open_exploration modes; speculative previews; SpaceProbe for intelligent layout; Accept/Reject UI.

### Insights System
- **Purpose**: Opt-in diagnostic system ("Test Flight") for workflow analysis.
- **Features**: Unified `Insight` model; actions (Explore, Defer, Add to PRD); no auto-run; no system-initiated experiments.

### Project Panel
- **Tabs**: KiteAI (AI assistant), Project (unified document), Layers (canvas hierarchy), Notes, Insights.
- **Persistence**: Collapsible panel and active tab state persisted in localStorage.

### PRD System (Project Tab)
- **AI-Powered Generation**: Generates Product Requirement Documents from workflow semantic models.
- **Features**: Stale detection, manual edit preservation, automatic backup.

### AI Integration Layer
- **Client Interface**: OpenAI-compatible API client.
- **Provider System**: React context-based AI provider supporting OpenAI (GPT-4o) and Ollama models.
- **Privacy Tiers**: UI options for "Maximum Privacy" (Ollama) and "Standard Privacy" (OpenAI, Anthropic).
- **Image-to-Workflow**: AI analysis of diagrams for conversion.
- **Unified Vision Pipeline**: Routes all input types (text, image, Figma) through a consistent PM conversation flow with actionability scoring and signal extraction.
- **PM Depth Guards**: Enforces PM-level reasoning depth by detecting tradeoffs, risks, irreversible actions, and meaningful branching. Requires specific proof obligations.

### Explainability, Auditability & Trust
- **Philosophy**: All additions are optional, read-only, and non-blocking.
- **Features**: Provenance metadata for nodes/edges, decision snapshots, structural timeline, audit export, "Why Inspector" for node explanations, enterprise guardrails.

### Semantic Completeness Enforcement
- **Purpose**: Detects when AI-generated workflows describe stateful behavior (retries, thresholds, escalation) but lack structural encoding.
- **Features**: Read-only detection by default, semantic claim extraction, structural analysis, mismatch detection, feature flag for blocking enforcement.

### Merge vs Branch Intent Heuristic
- **Purpose**: Detects user intent to modify existing workflows (merge) or create new variants (branch).
- **Features**: Passive detection via pattern matching, defaults to MERGE for ambiguous intent, integrated into chat workflow generation, audit visibility.

### Decision Repair Heuristic
- **Purpose**: Auto-repairs incomplete decision nodes (missing branches, unlabeled edges, dangling outcomes) before suggestions.
- **Features**: Repairs logic errors, never creates parallel workflows or deletes user nodes, idempotent. Addresses missing outcomes, unlabeled edges, dangling edges.

### GPT-5 Migration Foundation
- **Central AI Router**: `aiRouter.ts` for task-type based model selection.
- **Features**: Task-type model policy, session model lock, model provenance, retry & fallback mechanism, tolerant JSON parser, structured logging.

### Loop Detection System
- **Purpose**: Detects retry patterns lacking exit conditions or counters.
- **Features**: Detects `loop_without_exit`, `retry_without_counter`, `infinite_loop_risk` via cycle detection, self-loop detection, semantic exit condition checking. Surfaced via Test Flight diagnostics.

### Merge-Safe Workflow Mutation
- **Purpose**: Prevents orphan nodes and invalid graph states during chat-driven workflow edits.
- **Features**: Structural safety enforced at mutation time, blocks orphan nodes, floating islands, parallel workflows. Validates edges, resolves attachments. Integrates with decision repair and audit trail.
- **Entry Point**: `orchestrateChatWorkflowMutation()` combines repair and mutation, returning `repairInfo` and `combinedMutationSafety` for DecisionSnapshot and DiagnosticsEngine.
- **REPLACE Mode**: Atomic clear-and-replace with validation-only path (bypasses merge/repair). Uses `executeReplaceWorkflow` shared function with canvas-change guard (full JSON hash of node/edge data) and structural regression detection.
- **Structural Regression Guard**: `graphStructure.ts` computes branchingPoints, decisionNodes, labeledDecisionEdges. Shows warning modal (amber styling) before REPLACE if replacement would flatten workflow topology.

### Plugin Architecture
- **KiteFrameCore**: Plugin management system with `PluginProvider`, hooks, and event system, offering 8 defined extension points.

### Enterprise Security & Stability Features
- **Security**: Input validation, XSS sanitization, Zod schema validation.
- **Robustness**: Error boundaries, undo/redo system.
- **Performance**: `React.memo`, `useCallback`, `useMemo`.

### Kiteline Library Package (`@kiteline/core`)
- **Overview**: Standalone open-source npm package of the core canvas library.
- **Distribution**: TypeScript source, MIT License.
- **Documentation**: Comprehensive `README.md`, `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`.
- **Demo**: Interactive demo at `/demo` route.

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