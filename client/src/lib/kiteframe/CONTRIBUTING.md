# Contributing to Kiteline

First off, thank you for considering contributing to Kiteline! It's people like you that make Kiteline such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title** for the issue to identify the problem.
* **Describe the exact steps which reproduce the problem** in as many details as possible.
* **Provide specific examples to demonstrate the steps**. Include links to files or GitHub projects, or copy/pasteable snippets.
* **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
* **Explain which behavior you expected to see instead and why.**
* **Include screenshots and animated GIFs** which show you following the described steps and clearly demonstrate the problem.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title** for the issue to identify the suggestion.
* **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
* **Provide specific examples to demonstrate the steps** or point out the part of Kiteline where the suggestion is related to.
* **Describe the current behavior** and **explain which behavior you expected to see instead** and why.
* **Explain why this enhancement would be useful** to most Kiteline users.

### Pull Requests

* Fill in the required template
* Do not include issue numbers in the PR title
* Follow the TypeScript/React styleguide
* Include thoughtfully-worded, well-structured tests
* Document new code based on the Documentation Styleguide
* End all files with a newline

## Development Setup

1. Fork and clone the repo
```bash
git clone https://github.com/your-username/kiteline.git
cd kiteline
```

2. Install dependencies
```bash
npm install
```

3. Create a branch
```bash
git checkout -b feature/my-new-feature
```

4. Make your changes and test thoroughly

5. Run tests
```bash
npm test
```

6. Commit your changes
```bash
git commit -m "Add some feature"
```

7. Push to your fork
```bash
git push origin feature/my-new-feature
```

8. Create a Pull Request

## Styleguide

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line
* Consider starting the commit message with an applicable emoji:
    * 🎨 `:art:` when improving the format/structure of the code
    * 🐎 `:racehorse:` when improving performance
    * 📝 `:memo:` when writing docs
    * 🐛 `:bug:` when fixing a bug
    * 🔥 `:fire:` when removing code or files
    * ✅ `:white_check_mark:` when adding tests
    * 🔒 `:lock:` when dealing with security

### TypeScript Styleguide

* Use TypeScript for all new code
* Prefer `const` over `let`
* Use meaningful variable names
* Add JSDoc comments for public APIs
* Use proper typing, avoid `any`
* Follow existing code patterns and conventions

### React/JSX Styleguide

* Use functional components with hooks
* Keep components small and focused
* Use proper prop typing with TypeScript
* Follow the existing component structure
* Use meaningful component and prop names

## Project Structure

```
client/src/lib/kiteframe/
├── components/      # React components
├── core/           # Core plugin system
├── hooks/          # Custom React hooks
├── plugins/        # Built-in plugins
├── utils/          # Utility functions
├── types.ts        # TypeScript definitions
└── index.ts        # Public API exports
```

## Testing

* Write unit tests for utilities
* Write integration tests for components
* Ensure all tests pass before submitting PR
* Add tests for new features
* Update tests when modifying existing features

## Documentation

* Update the README.md if needed
* Add JSDoc comments for public APIs
* Update TypeScript definitions
* Include code examples for new features
* Keep documentation up to date

## Questions?

Feel free to open an issue with your question or reach out to the maintainers.

Thank you for contributing! 🎉
