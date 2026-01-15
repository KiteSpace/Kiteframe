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
- **Core AI Infrastructure**: Client interface supporting OpenAI-compatible APIs, with a React context-based AI provider supporting OpenAI (GPT-4o) and Ollama models.
- **Privacy Tiers**: UI options for "Maximum Privacy" (Ollama) and "Standard Privacy" (OpenAI, Anthropic).
- **Unified Vision Pipeline**: Routes all input types (text, image, Figma) through a consistent PM conversation flow with actionability scoring and signal extraction, enforcing PM-level reasoning depth.
- **AI Stabilization + Gold-Standard Guardrails (7-Part System)**: Comprehensive infrastructure to prevent cascading issues and over-construction in AI-generated workflows, including diagnostic delta gating, fix-scope locking, edit-first heuristic, Test Flight intent awareness, proposal structure contract, AI stability telemetry, and acceptance tests.
- **HOME Proposal Bypass**: Guardrails are bypassed for initial workflow generation in HOME/fullscreen mode.
- **GPT-5 Migration Foundation**: Central AI router for task-type based model selection, supporting model provenance, retry & fallback, and tolerant JSON parsing.
- **Merge vs Branch Intent Heuristic**: Detects user intent for workflow modification (merge) or new variant creation (branch).
- **Decision Repair Heuristic**: Auto-repairs incomplete decision nodes.
- **Semantic Completeness Enforcement**: Detects when AI-generated workflows describe stateful behavior but lack structural encoding.
- **Loop Detection System**: Detects retry patterns lacking exit conditions or counters.
- **Merge-Safe Workflow Mutation**: Prevents orphan nodes and invalid graph states during chat-driven workflow edits.

### Feature Flag System
- **Categories**: AI (`ai.*`), Canvas (`canvas.*`), Chat (`chat.*`), Enterprise (`enterprise.*`), Integration (`integrations.*`).
- **Dev Environment Configuration**: Flags are explicitly enabled or disabled for development.
- **Flag Seeding Behavior**: New flags are created, and existing flags are updated based on `defaultEnabled` values in seed configuration.

### Explainability, Auditability & Trust
- **Philosophy**: All additions are optional, read-only, and non-blocking.
- **Features**: Provenance metadata, decision snapshots, structural timeline, audit export, "Why Inspector", enterprise guardrails.

### Plugin Architecture
- **KiteFrameCore**: Plugin management system with `PluginProvider`, hooks, and event system, offering 8 defined extension points.

### Enterprise Security & Stability Features
- **Security**: Input validation, XSS sanitization, Zod schema validation.
- **Robustness**: Error boundaries, undo/redo system.
- **Performance**: `React.memo`, `useCallback`, `useMemo`.

### Kiteline Library Package (`@kiteline/core`)
- **Overview**: Standalone open-source npm package of the core canvas library.
- **Distribution**: TypeScript source, MIT License.

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