# KiteFrame Workflow Editor

## Overview

KiteFrame is a visual workflow editor built as a full-stack application with React and Express. The application provides an interactive canvas for creating and managing workflow diagrams with different node types (input, process, condition, output, AI tasks, and images). Users can create nodes, connect them with edges, and configure AI integration for processing workflows. The editor features a modern UI with drag-and-drop functionality, real-time canvas interactions, and comprehensive workflow management capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### January 2025 - KitelineAI Integration & Memory Optimization (Latest)

- **Two-Service Architecture Deployment:**
  - Successfully deployed KitelineAI as dedicated Ollama service at https://kiteline-ai.replit.app
  - Driftline (main app) connects to KitelineAI for privacy-focused AI processing
  - Autoscale deployment - only pay when users generate workflows
  - Zero data retention - AI processing without storage

- **Memory Constraint Resolution & Model Optimization:**
  - Identified and resolved 3.2 GiB memory limit on KitelineAI deployment
  - Successfully freed memory by removing oversized models (Qwen2.5 3B, Phi-3 Mini, Llama3.2 3B)
  - Added Gemma2 2B as the optimal model for current memory constraints
  - Attempted larger models (Llama 3.2 3B, Phi-3 Mini) but exceeded available memory (3.1 GiB)
  - Fixed TypeScript compilation errors in workflow generation code
  - Memory optimized deployment now supports Gemma2 2B model within constraints

- **OpenAI Integration Complete:**
  - Removed API key requirement for users - automatically uses environment secret
  - Updated UI to indicate OpenAI is ready to use without setup
  - Server-side integration automatically routes to stored OPENAI_API_KEY
  - Fixed model to GPT-4o across all components (not GPT-5 due to API access limitations)
  - Resolved API key routing issue that was using Anthropic keys for OpenAI requests
  - Added automatic legacy settings migration (gpt-5 → gpt-4o)
  - Quick test functionality confirmed working with GPT-4o
  - Simplified user experience for cloud AI access with no configuration needed

- **KitelineAI Model Deployment Complete:**
  - Successfully resolved memory constraints by removing Phi-3 Mini model
  - Llama 3.2 3B now running successfully on KitelineAI deployment
  - Freed sufficient memory (3.4 GiB required vs 3.3+ GiB available after cleanup)
  - Added automatic legacy settings migration (tinyllama:1.1b → llama3.2:3b)  
  - Quick test functionality confirmed working with Llama 3.2 3B
  - Fixed server-side default model routing for provider test endpoints
  - KitelineAI now provides privacy-focused Llama 3.2 3B processing as requested

- **Hybrid Privacy Approach Implementation:**
  - Added privacy-focused UI with "Maximum Privacy" and "Standard Privacy" tiers
  - Maximum Privacy: KitelineAI Managed, Local Ollama, Remote Ollama servers, Custom private endpoints
  - Standard Privacy: OpenAI, Anthropic with established privacy policies
  - Enhanced custom endpoint support with auto-detection for Ollama servers
  - Comprehensive guidance for users to choose appropriate privacy level

- **KitelineAI Managed Privacy Service:**
  - Added KitelineAI as a zero-setup privacy provider option
  - Complete Replit Autoscale deployment with TinyLlama 1.1B (working)
  - No API keys required - immediate privacy-focused AI access
  - Full deployment guide and configuration files for autoscale setup
  - Cost-effective solution scaling to zero when inactive

- **Ollama Local AI Integration:**
  - Added Ollama as a provider option for completely local AI processing
  - Integrated popular local models with seamless model switching
  - No API key required for Ollama - runs entirely on local hardware for privacy
  - Configurable endpoint (defaults to localhost:11434) with automatic service detection
  - Seamless integration with existing AI workflow generation and chat features

- **Enhanced AI Provider System:**
  - Dynamic provider routing based on model selection (Claude → Anthropic, local models → Ollama/Kiteframe)
  - Improved error handling with provider-specific messages for common issues
  - API key validation with better format checking and encoding error handling
  - Settings persistence across all AI features with localStorage integration
  - Provider-specific UI elements with privacy indicators and setup guidance
  - Fixed test button logic to skip API key validation for Ollama and Kiteframe providers
  - Updated error messages to show connection status instead of API key errors
  - Auto-detection of Ollama endpoints in custom provider mode
  - Modal height fixes with scrollable overflow for viewport compatibility

### January 2025 - AI Workflow Generation Fix & Auto Layout Feature

- **Auto Layout System Added:**
  - Added auto layout button to vertical toolbar with 5 layout options
  - Implemented Horizontal Flow, Vertical Flow, Grid Layout, Circular Layout, and Hierarchical layouts
  - Button only enabled when nodes are present on canvas
  - Dropdown closes automatically when clicking outside or selecting an option
  - All layouts save to history for undo/redo functionality

- **AI Workflow Generation Fixed:**
  - Resolved parameter mismatch preventing AI-generated workflows from appearing on canvas
  - Updated callback interface from separate parameters to single workflow object
  - Added comprehensive logging to track AI generation data flow
  - Verified successful integration between OpenAI API and canvas rendering
  - Updated AI to generate nodes in center of canvas instead of upper-left corner

- **Node Selection System Restored:**
  - Removed complex drag detection logic that was blocking click events
  - Restored simple click handling from pre-tabs implementation  
  - Fixed coordinate system issues with node interactions
  - Simplified drag/drop functionality to work without interfering with clicks

- **Additive Workflow Functionality:**
  - Implemented additive workflow system for sidebar import and AI generation buttons
  - AI generate button now prompts for workflow description and appends to existing canvas
  - Import button now opens file dialog and appends imported workflows to existing canvas
  - Added smart offset positioning system to place new workflows to the right of existing ones
  - Included unique ID generation with timestamps to prevent conflicts between workflows
  - Preserved history tracking and undo/redo functionality for all append operations

- **Dynamic Node Text Wrapping & Height Adjustment:**
  - Added automatic text wrapping for node titles and descriptions
  - Implemented dynamic node height calculation based on content length
  - Nodes maintain default 100px height for short content
  - Height automatically expands when text content requires more space
  - Maximum height limit of 400px with scrollable overflow for extremely long content
  - Preserved image node aspect ratio sizing with explicit height override
  - Enhanced text rendering with proper line spacing and paragraph break handling

- **Fixed Shift+Drag Multi-Node Selection (Latest):**
  - Restored shift+click+drag selection functionality for multiple nodes
  - Added proper event handling to distinguish between panning and selection modes
  - Implemented overlap detection for accurate node selection within bounding rectangle
  - Selection rectangle appears during drag with visual feedback
  - Multiple selected nodes can be moved together as a group

### December 2025 - Enhanced Image Management & Local Storage Implementation
- **Image Management System Overhaul:**
  - Added "Add image" buttons in both properties panel and image node bodies
  - Implemented hover trash can deletion with "cannot be undone" confirmation
  - Created enhanced modal with tabbed Upload/URL interface and real-time preview validation
  - Removed click-to-upload functionality from image nodes to prevent accidental uploads
  - Added comprehensive drag-and-drop visual feedback (green for valid, red for invalid files)

- **Local Storage for Privacy:**
  - Implemented LocalImageUploader component for browser-based image storage
  - Images converted to base64 data URLs and stored in browser memory
  - No external cloud storage required - images stay on user's local machine
  - Added privacy notices in upload interface

- **Canvas Coordinate System Fixes:**
  - Fixed major coordinate system mismatch causing offset shift+select behavior
  - Repositioned selection rectangle outside transformed world div using container-relative coordinates
  - Extended SVG layer to 10000px x 10000px to prevent edge clipping when nodes are dragged far
  - Implemented proper overlap detection for node selection (any overlap selects the node)
  - Added comprehensive coordinate logging system for debugging transformations

### Canvas Selection Controls
- **Shift+drag**: Creates selection rectangle to select multiple nodes by overlap
- **Click+drag**: Pans the canvas viewport  
- **Node drag**: Moves individual nodes in world coordinates
- **Wheel scroll**: Zooms in/out with proper coordinate transformation

## System Architecture

### Multi-Service Architecture
- **Driftline** (Main Application): Visual workflow editor at https://driftline.replit.app
- **KitelineAI** (AI Service): Dedicated Ollama service for privacy-focused AI processing
- **Service Communication**: Driftline connects to KitelineAI for AI workflow generation

### Frontend Architecture (Driftline)
- **Framework**: React 18 with TypeScript and Vite for development
- **UI Components**: Radix UI primitives with shadcn/ui design system
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **State Management**: React hooks for local state, TanStack Query for server state
- **Canvas System**: Custom KiteFrame library for interactive workflow canvas with node/edge management
- **Routing**: Wouter for lightweight client-side routing

### Backend Architecture (Driftline)
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Development**: Custom Vite integration for hot reloading in development
- **API Structure**: RESTful API with `/api` prefix routing
- **Storage Interface**: Pluggable storage system with in-memory implementation

### AI Service Architecture (KitelineAI)
- **Runtime**: Ollama on Replit Autoscale deployment
- **Models**: Llama 3.2 3B, Phi-3 Mini (optimized for fast startup)
- **API**: OpenAI-compatible endpoints for seamless integration
- **Privacy**: Data processed but never stored, dedicated infrastructure

### Data Storage Solutions
- **Database ORM**: Drizzle ORM configured for PostgreSQL
- **Schema Management**: Centralized schema definitions in shared directory
- **Migrations**: Drizzle Kit for database migrations
- **Development Storage**: In-memory storage implementation for development
- **Session Management**: PostgreSQL session store with connect-pg-simple

### Authentication and Authorization
- **User Model**: Basic user schema with username/password fields
- **Session Storage**: PostgreSQL-backed sessions
- **Password Security**: Framework ready for secure password hashing implementation

### Canvas and Workflow System
- **Node Types**: Support for input, process, condition, output, AI, and image nodes
- **Edge Management**: Bezier, straight, and step connection types with animation support
- **Interactive Features**: Drag-and-drop, zoom/pan, selection, context menus
- **Real-time Updates**: Live canvas updates with viewport synchronization
- **Export/Import**: Workflow serialization capabilities

### AI Integration Layer
- **Client Interface**: OpenAI-compatible API client with configurable endpoints
- **Provider System**: React context-based AI provider for component access
- **Model Support**: Default GPT-5 model with configurable alternatives
- **Settings Management**: Persistent AI configuration with local storage

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React 18, React DOM, React Query for state management
- **Build Tools**: Vite with TypeScript, ESBuild for production builds
- **Development**: TSX for TypeScript execution, Replit integration plugins

### UI and Styling
- **Component Library**: Radix UI primitives for accessible components
- **Styling**: Tailwind CSS with PostCSS, class-variance-authority for variants
- **Icons**: Font Awesome for consistent iconography
- **Utilities**: clsx and tailwind-merge for conditional styling

### Database and ORM
- **Database**: PostgreSQL via Neon serverless driver
- **ORM**: Drizzle ORM with Zod integration for type safety
- **Validation**: Zod schemas for runtime type checking
- **Migrations**: Drizzle Kit for schema management

### Development and Build
- **TypeScript**: Full TypeScript configuration with path mapping
- **Bundling**: Vite for development, ESBuild for production
- **Process Management**: Express server with custom Vite middleware
- **Environment**: Replit-specific configurations and plugins

### Workflow Canvas
- **Custom Library**: KiteFrame components for canvas interactions
- **Geometry Utils**: Custom utilities for viewport and coordinate transformations
- **Event Handling**: Mouse/touch event processing for canvas interactions
- **Rendering**: SVG-based edge rendering with marker support

### AI and External Services
- **AI Client**: OpenAI-compatible HTTP client implementation
- **Configuration**: Runtime AI provider configuration
- **Error Handling**: Comprehensive error management for AI service calls