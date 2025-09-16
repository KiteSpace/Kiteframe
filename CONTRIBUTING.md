# Contributing to KiteFrame

We love your input! We want to make contributing to KiteFrame as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## 🚀 Quick Start for Contributors

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/kiteframe.git
   cd kiteframe
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Run Tests**
   ```bash
   npm test
   npm run test:watch  # For watch mode
   ```

5. **Build Library**
   ```bash
   npm run build
   ```

### Project Structure

```
kiteframe/
├── client/src/lib/kiteframe/     # Core library code
│   ├── components/               # React components
│   ├── hooks/                    # React hooks
│   ├── utils/                    # Utility functions
│   ├── core/                     # Core systems
│   ├── plugins/                  # Plugin implementations
│   └── types.ts                  # Type definitions
├── docs/                         # Documentation
├── examples/                     # Example implementations
└── tests/                        # Test files
```

## 🐛 Reporting Bugs

We use GitHub issues to track bugs. Report a bug by [opening a new issue](https://github.com/your-org/kiteframe/issues/new?template=bug_report.md).

### Before Submitting a Bug Report

1. **Check existing issues** - Someone might have already reported it
2. **Use the latest version** - The bug might already be fixed
3. **Provide a minimal reproduction** - Help us understand the issue

### Writing a Good Bug Report

Include:
- **Clear title and description**
- **Steps to reproduce** (with code examples if possible)
- **Expected vs actual behavior**
- **Screenshots** (if applicable)
- **Environment details** (browser, Node.js version, etc.)

## 💡 Suggesting Features

We use GitHub issues to track feature requests. Suggest a feature by [opening a new issue](https://github.com/your-org/kiteframe/issues/new?template=feature_request.md).

### Before Suggesting a Feature

1. **Check if it already exists** - Look at existing features and issues
2. **Consider the scope** - Does it fit KiteFrame's mission?
3. **Think about backwards compatibility** - How does it affect existing users?

### Writing a Good Feature Request

Include:
- **Problem statement** - What problem does this solve?
- **Proposed solution** - How should it work?
- **Alternatives considered** - What other approaches did you consider?
- **Additional context** - Screenshots, mockups, examples

## 🔧 Code Contributions

### Development Workflow

1. **Create a branch** from `main`
   ```bash
   git checkout -b feature/amazing-feature
   # or
   git checkout -b fix/nasty-bug
   ```

2. **Make your changes**
   - Follow our coding standards
   - Add tests for new functionality
   - Update documentation

3. **Test thoroughly**
   ```bash
   npm test
   npm run lint
   npm run type-check
   ```

4. **Commit with conventional commits**
   ```bash
   git commit -m "feat: add amazing new feature"
   git commit -m "fix: resolve nasty bug"
   git commit -m "docs: update API documentation"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/amazing-feature
   ```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### Code Style Guidelines

#### TypeScript & React
- Use TypeScript for all new code
- Prefer functional components with hooks
- Use meaningful variable and function names
- Add proper type annotations
- Use `const` over `let` when possible

#### Formatting
- We use Prettier for code formatting
- Run `npm run format` before committing
- 2 spaces for indentation
- Single quotes for strings
- Trailing commas

#### Example Good Code

```tsx
interface NodeProps {
  id: string;
  label: string;
  onSelect: (id: string) => void;
}

const Node: React.FC<NodeProps> = ({ id, label, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(id);
  }, [id, onSelect]);

  return (
    <div 
      className="node"
      onClick={handleClick}
      data-testid={`node-${id}`}
    >
      {label}
    </div>
  );
};
```

### Testing Guidelines

- Write tests for all new features
- Aim for good test coverage
- Use meaningful test descriptions
- Test both happy path and edge cases

#### Test Structure

```tsx
describe('NodeComponent', () => {
  it('should render with correct label', () => {
    render(<Node id="1" label="Test Node" onSelect={jest.fn()} />);
    expect(screen.getByText('Test Node')).toBeInTheDocument();
  });

  it('should call onSelect when clicked', () => {
    const onSelect = jest.fn();
    render(<Node id="1" label="Test Node" onSelect={onSelect} />);
    
    fireEvent.click(screen.getByText('Test Node'));
    expect(onSelect).toHaveBeenCalledWith('1');
  });
});
```

## 🔌 Plugin Development

### Creating a Plugin

1. **Plugin Structure**
   ```tsx
   import { createPlugin } from 'kiteframe';

   export const myPlugin = createPlugin({
     name: 'my-plugin',
     version: '1.0.0',
     initialize: (core) => {
       // Plugin initialization logic
     },
     cleanup: () => {
       // Cleanup logic
     }
   });
   ```

2. **Plugin Guidelines**
   - Follow naming convention: `[name]-plugin`
   - Include proper documentation
   - Handle cleanup properly
   - Add tests
   - Consider backwards compatibility

### Plugin Categories

- **Core Plugins** - Essential functionality (included in library)
- **Community Plugins** - Community contributions (separate packages)
- **Pro Plugins** - Licensed enterprise features

## 📝 Documentation

### Writing Documentation

- Use clear, concise language
- Include code examples
- Add screenshots for UI features
- Keep it up to date with code changes

### Documentation Types

1. **API Documentation** - Function/component references
2. **Guides** - Step-by-step tutorials
3. **Examples** - Working code samples
4. **Architecture** - System design and concepts

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- NodeComponent.test.tsx
```

### Testing Categories

1. **Unit Tests** - Individual functions/components
2. **Integration Tests** - Component interactions
3. **E2E Tests** - Full user workflows
4. **Performance Tests** - Load and stress testing

## 🚀 Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- `MAJOR.MINOR.PATCH`
- Major: Breaking changes
- Minor: New features (backwards compatible)
- Patch: Bug fixes

### Release Checklist

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Run full test suite
4. Create GitHub release
5. Publish to npm
6. Update documentation

## 🤝 Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

### Enforcement

Instances of unacceptable behavior may be reported to the project maintainers. All complaints will be reviewed and investigated promptly and fairly.

## 💬 Getting Help

- **Issues**: [GitHub Issues](https://github.com/your-org/kiteframe/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/kiteframe/discussions)
- **Discord**: [Join our Discord](https://discord.gg/kiteframe)
- **Email**: contributors@kiteframe.io

## 🏆 Recognition

Contributors are recognized in:
- README contributors section
- GitHub contributor graphs
- Annual contributor highlights
- Special badges for significant contributions

## 📋 Checklist for PRs

Before submitting your PR, ensure:

- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] PR description explains changes
- [ ] Breaking changes are documented

Thank you for contributing to KiteFrame! 🎉