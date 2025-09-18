# Kiteframe Workflow Editor

## Overview
Kiteframe is a visual workflow editor built as a full-stack application with React and Express. It provides an interactive canvas for creating and managing workflow diagrams with various node types (input, process, condition, output, AI tasks, and images). The editor supports node creation, connection with edges, and AI integration for workflow processing, featuring a modern UI with drag-and-drop functionality and real-time canvas interactions. The project focuses on core workflow editing capabilities with advanced features like version control and enhanced interactions available through a plugin architecture.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Service Architecture
- **Kiteframe (Main Application)**: The visual workflow editor.
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
- **User Model**: Basic user schema with username/password fields.
- **Session Storage**: PostgreSQL-backed sessions.

### Canvas and Workflow System
- **Node Types**: Supports input, process, condition, output, AI, and image nodes with dynamic text wrapping and height adjustment.
- **Edge Management**: Comprehensive edge system with properties panel, validation, templates, and factory for creating connections.
- **Interactive Features**: Drag-and-drop, zoom/pan, multi-node selection (Shift+drag), context menus, keyboard shortcuts, minimap, zoom controls, and canvas toolbar.
- **Auto-Layout**: 5 layout options (Horizontal Flow, Vertical Flow, Grid, Circular, Hierarchical).
- **Workflow Generation**: AI-generated workflows from text prompts and image analysis are appended to the canvas with smart offset positioning.
- **Image Analysis**: Upload workflow diagrams (PNG, JPG, GIF up to 10MB) with drag-and-drop support, confidence scoring above 70% threshold, and comprehensive error handling.
- **Image Management**: Enhanced system for uploading images via URL or local storage (base64 data URLs) with privacy notices.

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