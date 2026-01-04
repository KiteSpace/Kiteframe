# Kiteframe Workflow Editor

## Overview
Kiteframe is a visual workflow editor for creating and managing interactive diagrams with various node types (input, process, condition, output, AI tasks, and images). It features a modern UI with drag-and-drop functionality, real-time canvas interactions, and AI integration for workflow processing and generation. The project aims to provide core workflow editing capabilities with advanced features delivered through a plugin architecture. Its core canvas library has been extracted into an open-source npm package, Kiteline (`@kiteline/core`), complete with documentation and a demo website.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Service Architecture
- **Kiteframe**: The main visual workflow editor web application.
- **Kiteline Library (`@kiteline/core`)**: An extracted, standalone open-source npm package containing the core canvas library.
- **KitelineAI**: A dedicated Ollama service for privacy-focused AI processing, communicating with Kiteframe for AI workflow generation.

### Frontend Architecture (Kiteframe)
- **Framework**: React 18 with TypeScript and Vite.
- **UI Components**: Radix UI primitives with shadcn/ui.
- **Styling**: Tailwind CSS.
- **State Management**: React hooks for local state, TanStack Query for server state.
- **Canvas System**: Custom KiteFrame library for interactive workflow canvas.
- **Routing**: Wouter.

### Backend Architecture (Kiteframe)
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **API Structure**: RESTful API (`/api` prefix).
- **Storage Interface**: Pluggable storage system with in-memory implementation for development.

### AI Service Architecture (KitelineAI)
- **Runtime**: Ollama on Replit Autoscale.
- **Models**: Optimized for fast startup (Gemma2 2B, Llama 3.2 3B).
- **API**: OpenAI-compatible endpoints.
- **Privacy**: Data processed but not stored.

### Data Storage Solutions
- **Database ORM**: Drizzle ORM for PostgreSQL.
- **Schema Management**: Centralized schema definitions with Drizzle Kit for migrations.
- **Session Management**: PostgreSQL session store using `connect-pg-simple`.

### Authentication and Authorization
- **Multi-Provider OAuth**: Supports Google, GitHub, and Replit.
- **Account Linking**: Links multiple OAuth providers to a single user account by email.
- **Session Storage**: PostgreSQL-backed sessions with Passport.js.
- **Firebase-Backend Sync**: Frontend Firebase authentication syncs to backend Passport sessions via `/api/auth/firebase-sync` for cloud project access, requiring Firebase Admin SDK credentials for full functionality.

### Subscription System (KiteAI)
- **Tiered Model**: Free, Advanced, and Pro tiers with monthly credit allocations.
- **Stripe Integration**: Checkout, Customer Portal, and webhooks for subscription management.

### Canvas and Workflow System
- **Node Types**: Input, process, condition, output, AI, experiment, and image nodes with dynamic sizing.
- **Edge Management**: Comprehensive system with properties, validation, and templates.
- **Interactive Features**: Drag-and-drop, zoom/pan, multi-node selection, context menus, keyboard shortcuts, minimap, toolbar.
- **Auto-Layout**: Five layout options (Horizontal Flow, Vertical Flow, Grid, Circular, Hierarchical).
- **Workflow Generation**: AI-generated workflows from text prompts and image analysis.
- **Image Analysis**: Upload and analyze workflow diagrams (PNG, JPG, GIF) to convert into interactive workflows.
- **Figma Import**: Import Figma designs as interactive image nodes with screenshot caching.

### Experiment Node System
- **Purpose**: AI-powered speculative branch authoring for exploring what-if scenarios and enhancements.
- **Modes**: whatif (alternative paths), enhancement (improvements), open_exploration (freeform).
- **Speculative Preview**: Generated branches marked with `meta.speculative=true`, styled with dashed edges and opacity, excluded from exports/PRD.
- **SpaceProbe**: Intelligent layout positioning with collision detection and overlap scoring algorithm.
- **ExperimentBranchHeader**: Purple overlay component above origin node with Accept/Reject buttons and drag-all functionality.
- **Edit-After-Accept**: ExperimentEditButton popover appears on process nodes with `meta.experiment.acceptedAt`, allowing mode selection and regeneration.

### Insights System
- **Philosophy**: Canvas is judgment-free; diagnostics are opt-in via "Test Flight" in the Insights tab.
- **No Auto-Run**: Insights are only generated when user explicitly clicks "Test Flight".
- **Insight Type**: Unified `Insight` model in `client/src/lib/kiteframe/utils/insights/types.ts`.
- **Insight Actions**: Explore (creates Experiment node), Defer, Add to PRD.
- **Hover/Click Interactions**: Hovering insight cards highlights related nodes; clicking pans canvas to related nodes.
- **No System-Initiated Experiments**: All experiment creation requires explicit user action.

### Project Panel
- **Tabs**: KiteAI (AI assistant), Project (unified document), Layers (canvas hierarchy), Notes, Insights.
- **Persistence**: Collapsible panel and active tab state persisted in localStorage.

### PRD System (Project Tab)
- **AI-Powered PRD Generation**: Generates Product Requirement Documents from workflow semantic models.
- **Stale Detection**: Identifies when workflows have changed since the last PRD generation.
- **Manual Edit Preservation**: Preserves manual edits during regeneration.
- **Backup System**: Automatic backup before regeneration.

### AI Integration Layer
- **Client Interface**: OpenAI-compatible API client.
- **Provider System**: React context-based AI provider supporting OpenAI (GPT-4o) and Ollama models (KitelineAI, local, custom endpoints).
- **Privacy Tiers**: UI options for "Maximum Privacy" (Ollama-based) and "Standard Privacy" (OpenAI, Anthropic).
- **Image-to-Workflow Generation**: AI analysis of diagrams for conversion to interactive workflows.

### Unified Vision Pipeline
- **Purpose**: Routes all input types (text, image, Figma) through the same PM conversation flow with consistent actionability scoring.
- **VisionExtractedSignals**: Captures flowsDetected, branching, screensDetected, primaryCTA, decisionPoints, entryPoints.
- **computeActionabilityWithVision()**: Enhances base actionability score with vision signals.

### PM Depth Guards
- **Purpose**: Enforces PM-level reasoning depth, blocking workflows that are structurally valid but lack meaningful product decisions.
- **Detection Functions**: `detectTradeoff()`, `detectRisk()`, `detectIrreversible()`, `detectNonRetryBranches()`.
- **Gate Condition**: Requires AT LEAST ONE of: tradeoff, risk, irreversible action, or meaningful branching.
- **Role Context**: Applies when role === 'pm' OR (role === 'hybrid' AND confidence >= 0.7).
- **System Prompt**: Requires 5 proof obligations (WHO, GOAL, DECISIONS 3+, TRADEOFF 1+, FAILURE MODE 1+).

### Explainability, Auditability & Trust
- **Philosophy**: All additions are optional, read-only, and non-blocking.
- **Provenance Metadata**: NodeMeta and EdgeMeta now include immutable fields: `createdFromInsightId`, `createdFromProposalId`, `createdFromExperimentId`, `createdAt`.
- **Decision Snapshots**: Structured capture of heuristics, scope rules, variant choice, session context, uncertainty level, and validation warnings.
- **Structural Timeline**: Tracks Accept/Undo/Redo events with timestamps. Session-scoped.
- **Audit Export**: `generateAuditExport()` produces JSON with workflow structure, provenance, snapshots, and timeline.
- **Why Inspector**: `WhyInspector.tsx` provides read-only popover showing "why this node exists" with insight linkage and heuristics applied.
- **Enterprise Guardrails**: Config-level hooks (`aiActionsDisabled`, `readOnlyMode`, `auditOnlyAccess`).

### GPT-5 Migration Foundation
- **Central AI Router**: All AI calls route through `client/src/ai/router/aiRouter.ts` with task-type based model selection.
- **Task-Type Model Policy**: Defined in `types.ts` - GPT-5 for workflow_reasoning/workflow_experiments/prd_generation, GPT-4o for vision_ingestion, user-selected for general_chat.
- **Session Model Lock**: Model/provider locked at session start.
- **Model Provenance**: `ModelProvenance` interface captures providerUsed, modelUsed, routerTaskType, usedFallback, fallbackModelUsed, sessionId. Added to DecisionSnapshot for audit trail.
- **Retry & Fallback**: Max 1 retry with same model, then fallback GPT-5 → GPT-4o with metadata tracking.
- **Tolerant JSON Parser**: `jsonParser.ts` extracts JSON from fenced code blocks, validates with Zod schemas.

### Plugin Architecture
- **KiteFrameCore**: Plugin management system with `PluginProvider`, hooks, and an event system.
- **Extension Points**: 8 defined extension points for canvas interactions.

### Enterprise Security & Stability Features
- **Security**: Input validation, text sanitization (XSS prevention), Zod schema validation.
- **Error Boundaries**: Robust error handling with component isolation and fallback UI.
- **Undo/Redo System**: Command pattern implementation with batching and history limits.
- **Performance Optimization**: `React.memo`, `useCallback`, `useMemo` for critical components.

### Kiteline Library Package (@kiteline/core)
- **Overview**: Standalone open-source npm package of the core canvas library (`client/src/lib/kiteframe/`).
- **Distribution**: TypeScript source files, MIT License.
- **Documentation**: Comprehensive `README.md`, `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`.
- **Demo Website**: Interactive demo at `/demo` route showcasing features, installation, and API examples.

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