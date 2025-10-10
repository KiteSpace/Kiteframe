# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-10-10

### Added
- Initial release of Kiteline
- Interactive canvas with zoom, pan, and minimap
- 6 built-in node types: Input, Process, Condition, Output, AI, and Image
- 6 edge types: Bezier, Straight, Step, Smoothstep, Curved, and Orthogonal
- 4 auto-layout algorithms: Horizontal, Vertical, Circular, and Hierarchical
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
- Additional node renderers
- More layout algorithms
- Enhanced accessibility features
- Performance optimizations for large workflows
- Mobile touch support improvements
