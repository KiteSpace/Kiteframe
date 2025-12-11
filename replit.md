# Kiteframe Workflow Editor

## Overview
Kiteframe is a visual workflow editor built as a full-stack application with React and Express. It provides an interactive canvas for creating and managing workflow diagrams with various node types (input, process, condition, output, AI tasks, and images). The editor supports node creation, connection with edges, and AI integration for workflow processing, featuring a modern UI with drag-and-drop functionality and real-time canvas interactions. The project focuses on core workflow editing capabilities with advanced features like version control and enhanced interactions available through a plugin architecture.

The core canvas library has been extracted as **Kiteline** (`@kiteline/core`), a standalone open-source npm package ready for publication with comprehensive documentation, demo website, and enterprise-grade features.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Service Architecture
- **Kiteframe (Main Application)**: The visual workflow editor web app.
- **Kiteline Library** (`@kiteline/core`): Extracted open-source npm package of the core canvas library, ready for publication.
- **KitelineAI (AI Service)**: A dedicated Ollama service for privacy-focused AI processing. Kiteframe communicates with KitelineAI for AI workflow generation.

### Frontend Architecture (Kiteframe)
- **Framework**: React 18 with TypeScript and Vite.
- **UI Components**: Radix UI primitives with shadcn/ui design system.
- **Styling**: Tailwind CSS with CSS custom properties.
- **State Management**: React hooks for local state, TanStack Query for server state.
- **Canvas System**: Custom KiteFrame library for interactive workflow canvas with node/edge management.
- **Routing**: Wouter for lightweight client-side routing.

### Backend Architecture (Kiteframe)
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **API Structure**: RESTful API with `/api` prefix routing.
- **Storage Interface**: Pluggable storage system with in-memory implementation.

### AI Service Architecture (KitelineAI)
- **Runtime**: Ollama on Replit Autoscale deployment.
- **Models**: Optimized for fast startup, currently supporting Gemma2 2B and Llama 3.2 3B.
- **API**: OpenAI-compatible endpoints.
- **Privacy**: Data processed but not stored, dedicated infrastructure.

### Data Storage Solutions
- **Database ORM**: Drizzle ORM configured for PostgreSQL.
- **Schema Management**: Centralized schema definitions and Drizzle Kit for database migrations.
- **Development Storage**: In-memory storage implementation.
- **Session Management**: PostgreSQL session store with connect-pg-simple.

### Authentication and Authorization
- **Multi-Provider OAuth**: Support for Google, GitHub, and Replit authentication.
- **OAuth Providers Table**: Allows users to link multiple OAuth providers to a single account.
- **User Model**: Database users with email, profile info, subscription tier, and linked OAuth providers.
- **Session Storage**: PostgreSQL-backed sessions with Passport.js.
- **Account Linking**: Automatically links new OAuth providers to existing accounts by email match.
- **Firebase-Backend Sync**: Frontend Firebase auth syncs to backend Passport sessions via `/api/auth/firebase-sync` endpoint for cloud project access.

#### Firebase Service Account Setup (Required for Cloud Projects)
Cloud-saved projects require Firebase Admin SDK credentials for secure token verification. Without credentials, users can still sign in via Firebase but cloud project sync returns 503.

**To enable cloud projects:**
1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate a new private key (JSON file)
3. Add the JSON content as `FIREBASE_SERVICE_ACCOUNT_KEY` secret in Replit
4. Restart the application - you should see "Firebase Admin initialized with credentials" in logs

**Verification:**
- With credentials: Sign-in syncs to backend, `/api/auth/user` returns user data, cloud projects save/load
- Without credentials: Sign-in works but backend returns 503 on sync, local storage only

### Subscription System (KiteAI)
- **Three-Tier Model**: Free (25 credits/month), Advanced (150 credits/month, $14.99/mo), Pro (500 credits/month, $29.99/mo).
- **Stripe Integration**: Checkout for subscriptions, Customer Portal for management, webhooks for events.
- **Credit System**: Monthly credit allocation based on subscription tier, tracked per authenticated user.
- **Saved Projects**: Pro tier feature for cloud-saved workflows with folder organization.
- **Pricing Page**: Tier comparison, feature lists, and Stripe Checkout integration.
- **Account Management**: Connected auth providers, subscription management, account deletion flow.

### Canvas and Workflow System
- **Node Types**: Supports input, process, condition, output, AI, and image nodes with dynamic text wrapping and height adjustment.
- **Edge Management**: Comprehensive edge system with properties panel, validation, templates, and factory for creating connections.
- **Interactive Features**: Drag-and-drop, zoom/pan, multi-node selection (Shift+drag), context menus, keyboard shortcuts, minimap, zoom controls, and canvas toolbar.
- **Auto-Layout**: 5 layout options (Horizontal Flow, Vertical Flow, Grid, Circular, Hierarchical).
- **Workflow Generation**: AI-generated workflows from text prompts and image analysis are appended to the canvas with smart offset positioning.
- **Image Analysis**: Upload workflow diagrams (PNG, JPG, GIF up to 10MB) with drag-and-drop support, confidence scoring above 70% threshold, and comprehensive error handling.
- **Image Management**: Enhanced system for uploading images via URL or local storage (base64 data URLs) with privacy notices.
- **Figma Import**: Import Figma designs as interactive webview nodes via Power Features menu or HomeScreen, supports both new project creation and insertion into existing workflows, uses Figma embed URLs for iframe compatibility.

### Power Features
- **Floating Menu**: Rocket icon button on canvas for quick access to power features.
- **Figma Import**: Import designs from Figma URLs directly into workflows with dual-mode support (new-project or insert-into-project). Auto-tracks imported Figma files in Sources tab.
- **Integration Architecture**: Files in `client/src/lib/integration/` for URL parsing and embed URL generation.

### Project Panel
- **Five Tabs**: Layers (canvas hierarchy), Notes (markdown notes), Specs (PRD/design specs), Sources (external links/references), Details (project metadata).
- **Collapsible**: Panel can be collapsed to icon-only sidebar, persists state in localStorage.
- **Per-Project Storage**: All panel content scoped by projectId with localStorage persistence.

### PRD System (Specs Tab)
- **Workflow Spec Generation**: AI-powered PRD generation from workflow semantic model using configured AI provider.
- **Semantic Hashing**: Content-based hash (excludes position/style) to detect meaningful workflow changes.
- **Stale Detection**: Banner shows when workflow has changed since last PRD generation.
- **Manual Edit Preservation**: Per-section tracking of manual edits; regeneration preserves manually edited sections.
- **Section-Level Control**: Edit individual sections with markdown, reset to AI-generated content per section.
- **Backup System**: Automatic backup before regeneration with restore capability.
- **Workflow Grouping**: Multi-workflow support with selector for complex canvas layouts.

### AI Integration Layer
- **Client Interface**: OpenAI-compatible API client with configurable endpoints.
- **Provider System**: React context-based AI provider with dynamic routing and enhanced error handling.
- **Model Support**: Integrates with OpenAI (GPT-4o) and local/remote Ollama models (KitelineAI, local Ollama, custom endpoints).
- **Privacy Tiers**: UI offers "Maximum Privacy" (KitelineAI, local Ollama, custom) and "Standard Privacy" (OpenAI, Anthropic) options.
- **Settings Management**: Persistent AI configuration via local storage.
- **Image-to-Workflow Generation**: AI-powered analysis of hand-drawn or digital workflow diagrams using GPT-4o Vision API with confidence scoring and real-time conversion to interactive workflows.

### Plugin Architecture
- **KiteFrameCore**: Comprehensive plugin management system with PluginProvider, hooks, and an event system.
- **Extension Points**: 8 extension points for canvas interactions.
- **Demo Plugins**: Includes TestPlugin, ConsolePlugin, LayoutPlugin, and MultiSelectPlugin.
- **Pro Plugins**: Advanced Interactions and Version Control plugins for premium features.
- **Auto-registration**: Seamless plugin activation.

## Enterprise Security & Stability Features

### Security Implementation
- **Input Validation**: Comprehensive validation for colors (hex/rgb/hsl), text sanitization to prevent XSS, and data schema validation using Zod.
- **Content Security**: Sanitization of all user inputs including node labels, edge properties, and descriptions to prevent script injection.
- **Error Boundaries**: Robust error handling with component isolation, automatic recovery, and fallback UI for graceful degradation.

### Core Systems
- **Undo/Redo System**: Command pattern implementation with batching, debouncing, history limits, and keyboard shortcuts (Ctrl+Z/Y).
- **Performance Optimization**: React.memo on all critical components, useCallback for event handlers, useMemo for expensive calculations.
- **Memory Management**: Proper cleanup of event listeners and timers to prevent memory leaks.

## Kiteline Library Package (@kiteline/core)

### Package Overview
The core canvas library has been extracted as a standalone open-source npm package located at `client/src/lib/kiteframe/`.

**Publishing Details:**
- **Package Name**: `@kiteline/core`
- **Version**: 1.0.0
- **License**: MIT
- **Distribution**: Ships TypeScript source files (requires consumer-side transpilation)
- **Repository**: https://github.com/kiteline/kiteline
- **Homepage**: https://kiteline.dev

### Documentation
- **README.md**: Comprehensive feature documentation, installation guide, quick start, API reference, and examples (free features only)
- **LICENSE**: MIT License
- **CONTRIBUTING.md**: Contribution guidelines, development setup, styleguides, and PR process
- **CODE_OF_CONDUCT.md**: Contributor Covenant Code of Conduct with enforcement contact (conduct@kiteline.dev)
- **CHANGELOG.md**: Version history following Keep a Changelog format

### Demo Website
Interactive demo site at `/demo` route showcasing:
- Hero section with live interactive canvas
- 8 feature cards (Interactive Canvas, Rich Nodes, Flexible Edges, Auto Layouts, Undo/Redo, Plugin System, Enterprise Security, Import/Export)
- Installation and quick start guide with copy-to-clipboard code examples
- API examples for Nodes, Edges, and Plugins
- 3-step getting started guide
- Full dark mode support and responsive design

### Package Structure
- **Exports**: TypeScript source files via `index.ts` and CSS via `styles/*`
- **Peer Dependencies**: React 18+, React DOM 18+
- **Dependencies**: Zod for validation
- **Files**: All component, core, hooks, utils, and plugin directories included

### Free Features Included
All core functionality is included in the open-source package:
- 6 node types (input, process, condition, output, AI, image)
- 6 edge types with styling and validation
- 5 auto-layout algorithms
- Undo/Redo system
- Plugin architecture with 8 extension points
- Import/Export functionality
- Enterprise security features
- Full TypeScript support

**Note**: Pro features (Advanced Interactions, Version Control, Smart Connect, Collaboration) are omitted from public documentation and package.

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React 18, React DOM, TanStack Query.
- **Build Tools**: Vite, TypeScript, ESBuild.

### UI and Styling
- **Component Library**: Radix UI primitives.
- **Styling**: Tailwind CSS, PostCSS, `class-variance-authority`.
- **Icons**: Font Awesome.
- **Utilities**: `clsx`, `tailwind-merge`.

### Database and ORM
- **Database**: PostgreSQL via Neon serverless driver.
- **ORM**: Drizzle ORM.
- **Validation**: Zod.
- **Migrations**: Drizzle Kit.

### Development and Build
- **TypeScript**: Full TypeScript configuration.
- **Bundling**: Vite for development, ESBuild for production.
- **Process Management**: Express server with custom Vite middleware.

### Workflow Canvas
- **Custom Library**: Kiteframe components for canvas interactions.
- **Geometry Utils**: Custom utilities for coordinate transformations.
- **Event Handling**: Mouse/touch event processing.
- **Rendering**: SVG-based edge rendering.

### AI and External Services
- **AI Client**: OpenAI-compatible HTTP client implementation.
- **Ollama**: Integrated for local and remote AI model serving.
- **OpenAI**: Integrated for cloud-based AI services.
- **Anthropic**: Supported as an AI provider option.

## Documentation

### Technical Documentation
- **Node System Architecture**: `docs/NODE_SYSTEM.md` - Comprehensive documentation covering all node types, registration, TypeScript interfaces, data binding, TableNode/CompoundNode implementation details, edge system, and NodeHandles.