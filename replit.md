# KiteFrame Workflow Editor

## Overview

KiteFrame is a visual workflow editor built as a full-stack application with React and Express. The application provides an interactive canvas for creating and managing workflow diagrams with different node types (input, process, condition, output, AI tasks, and images). Users can create nodes, connect them with edges, and configure AI integration for processing workflows. The editor features a modern UI with drag-and-drop functionality, real-time canvas interactions, and comprehensive workflow management capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

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