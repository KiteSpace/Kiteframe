# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2024-12-27

### Added
- **Layer visibility controls**: Hide/show individual nodes, workflows, or groups from the canvas via Layers panel
- **Layer lock controls**: Lock nodes and workflows to prevent accidental editing, dragging, or deletion
- **Copy-paste edge preservation**: Copy-paste now includes connected edges between selected nodes, maintaining workflow structure
- **Improved clipboard management**: Enhanced ClipboardManager with proper ID remapping for pasted edges
- **Undo/redo for visibility/lock**: All visibility and lock state changes are tracked in command history

### Changed
- Visibility state persisted in localStorage for session continuity
- Lock enforcement guards prevent all modifications to locked items (position, deletion, property changes)

### Fixed
- Copy-paste no longer loses edge connections between copied nodes

## [1.1.0] - 2024-12-16

### Added
- **6 new node types**: Table, Form, Compound, Webview, Code, and Render nodes (now 12 total)
- **Canvas objects**: Sticky notes, shapes, and text annotations on the canvas
- **Node status tracking**: Todo, in-progress, and done states for task management
- **Configurable zoom limits**: `minZoom` and `maxZoom` props (default 0.1x - 3x)
- **Viewport control props**: `disablePan`, `disableWheelZoom` for customization
- **Pro features config**: `proFeatures` prop for advanced plugin configuration

### Pro Features (requires proFeatures config)
- **Edge reconnection**: Drag edge endpoints to reconnect to different nodes
- **Smart connect**: Intelligent edge connection suggestions
- **Quick-add handles**: Hover nodes to see (+) buttons for instant node creation

### Changed
- Updated documentation to reflect all 12 node types
- Improved API reference with complete props documentation
- Enhanced Node and Edge type definitions with more options

### Fixed
- Touch gesture conflicts with node drag interactions (gestures temporarily disabled)

### Known Limitations
- Touch gestures (pinch-zoom, two-finger pan) are disabled due to conflicts with node interactions
- Mobile users should use minimap or toolbar controls for zoom/pan

## [1.0.0] - 2024-10-10

### Added
- Initial release of Kiteline
- Interactive canvas with zoom, pan, and minimap
- 6 built-in node types: Input, Process, Condition, Output, AI, and Image
- 6 edge types: Bezier, Straight, Step, Smoothstep, Curved, and Orthogonal
- 5 auto-layout algorithms: Horizontal, Vertical, Grid, Circular, and Hierarchical
- Undo/Redo system with command pattern
- Plugin architecture with 8 extension points
- Edge validation system with customizable rules
- Edge templates for reusable styled connections
- Import/Export workflow JSON functionality
- Input validation and XSS prevention
- Error boundaries for graceful degradation
- Rate limiting for client-side protection
- Pixel-perfect rendering at all zoom levels
- Dark mode support via CSS custom properties
- TypeScript support with full type definitions
- Comprehensive documentation and examples

### Security
- Input sanitization to prevent XSS attacks
- Zod-based schema validation
- Rate limiting for client-side operations
- Memory management with automatic cleanup

## [Unreleased]

### Planned
- Touch gesture support for mobile devices
- Enhanced accessibility features
- Performance optimizations for large workflows
