# KiteFrame Workflow Editor

## Overview

KiteFrame is a visual workflow editor built as a full-stack application with React and Express. The application provides an interactive canvas for creating and managing workflow diagrams with different node types (input, process, condition, output, AI tasks, and images). Users can create nodes, connect them with edges, and configure AI integration for processing workflows. The editor features a modern UI with drag-and-drop functionality, real-time canvas interactions, and comprehensive workflow management capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

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

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for development
- **UI Components**: Radix UI primitives with shadcn/ui design system
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **State Management**: React hooks for local state, TanStack Query for server state
- **Canvas System**: Custom KiteFrame library for interactive workflow canvas with node/edge management
- **Routing**: Wouter for lightweight client-side routing

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Development**: Custom Vite integration for hot reloading in development
- **API Structure**: RESTful API with `/api` prefix routing
- **Storage Interface**: Pluggable storage system with in-memory implementation

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