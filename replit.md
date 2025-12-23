# Kiteframe Workflow Editor

## Overview
Kiteframe is a visual workflow editor for creating and managing interactive diagrams with various node types (input, process, condition, output, AI tasks, and images). It features a modern UI with drag-and-drop functionality, real-time canvas interactions, and AI integration for workflow processing and generation. The project aims to provide core workflow editing capabilities with advanced features delivered through a plugin architecture. The core canvas library has been extracted into an open-source npm package, Kiteline (`@kiteline/core`), complete with documentation and a demo website.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Service Architecture
- **Kiteframe**: The main visual workflow editor web application.
- **Kiteline Library (`@kiteline/core`)**: An extracted, standalone open-source npm package containing the core canvas library.
- **KitelineAI**: A dedicated Ollama service designed for privacy-focused AI processing, communicating with Kiteframe for AI workflow generation.

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
- **Features**: Credit system, cloud-saved projects (Pro tier), pricing page, and account management.

### Canvas and Workflow System
- **Node Types**: Input, process, condition, output, AI, and image nodes with dynamic sizing.
- **Edge Management**: Comprehensive system with properties, validation, and templates.
- **Interactive Features**: Drag-and-drop, zoom/pan, multi-node selection, context menus, keyboard shortcuts, minimap, toolbar.
- **Auto-Layout**: Five layout options (Horizontal Flow, Vertical Flow, Grid, Circular, Hierarchical).
- **Workflow Generation**: AI-generated workflows from text prompts and image analysis.
- **Image Analysis**: Upload and analyze workflow diagrams (PNG, JPG, GIF) to convert into interactive workflows.
- **Figma Import**: Import Figma designs as interactive image nodes with screenshot caching.
- **Figma Caching**: Figma frames are imported with cached screenshots and `cachedAt` timestamps. Non-authenticated users can view cached frames; refresh button only appears when authenticated with Figma. Calendar icon in node header shows cache date.
- **Touch Gestures**: The `enableTouchGestures` prop exists but touch pinch-zoom/pan is currently disabled due to conflicts with node drag interactions. Mobile users should use minimap or toolbar controls for zoom/pan.

### Project Panel
- **Tabs**: KiteAI (AI assistant), Project (unified document), Layers (canvas hierarchy).
- **KiteAI Tab**: AI-powered workflow generation.
- **Project Tab**: Combines project overview, workflow selection with inline PRD generation, markdown notes, and external sources.
- **Layers Tab**: Workflow-first hierarchical view with search and visibility toggles.
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

### Unified Vision Pipeline (KiteAI)
- **Location**: `client/src/ai/kiteaiState.ts`, `client/src/ai/actionability.ts`, `client/src/hooks/useKiteAIConversation.ts`
- **Purpose**: Routes all input types (text, image, Figma) through the same PM conversation flow with consistent actionability scoring.
- **ConversationSource**: Tracks text prompts, images, and Figma frames with extracted vision signals.
- **VisionExtractedSignals**: Captures flowsDetected, branching, screensDetected, primaryCTA, decisionPoints, entryPoints.
- **computeActionabilityWithVision()**: Enhances base actionability score with vision signals, boosting confidence up to 0.3.
- **Vision Signal Extraction**: Extracts signals from AI responses via regex patterns in PreProjectChat.
- **Dimension Satisfaction**: Vision signals can satisfy actionability dimensions (flowSignal, scope, trigger, goal).

### PM Depth Guards (Phase 3.5)
- **Location**: `client/src/ai/guards/pmDepthGuards.ts`
- **Purpose**: Enforces PM-level reasoning depth, blocking workflows that are structurally valid but lack meaningful product decisions.
- **Detection Functions**:
  - `detectTradeoff()`: Identifies speed vs accuracy, friction vs conversion, option A/B patterns
  - `detectRisk()`: Finds fraud, churn, abuse mentions with mitigations
  - `detectIrreversible()`: Detects account creation, payments, data submission
  - `detectNonRetryBranches()`: Validates branches lead to different outcomes
- **Gate Condition**: Requires AT LEAST ONE of: tradeoff, risk, irreversible action, or meaningful branching
- **Role Context**: Only applies when role === 'pm' OR (role === 'hybrid' AND confidence >= 0.7)
- **System Prompt**: `client/src/ai/prompts/system.pm.txt` requires 5 proof obligations (WHO, GOAL, DECISIONS 3+, TRADEOFF 1+, FAILURE MODE 1+)

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
- **Internal Developer Docs**: Live interactive examples at `/internal/docs` (requires docs access, separate from admin access).
- **Free Features**: All core functionality, including 6 node types, 6 edge types, 5 auto-layout algorithms, undo/redo, and plugin architecture.

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