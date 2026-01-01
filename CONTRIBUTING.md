# Contributing to TETSUO Wallet SDK

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the TETSUO Wallet SDK project.

## Code of Conduct

- Be respectful and constructive in all interactions
- Focus on code quality and functionality
- Help others learn and improve

## Getting Started

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/tetsuo-wallet-sdk.git
   cd tetsuo-wallet-sdk
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

## Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, well-structured code
   - Follow TypeScript best practices
   - Add type definitions
   - Write meaningful variable and function names

3. **Write or update tests**
   - Add tests for new features
   - Ensure all tests pass: `npm test`
   - Aim for good code coverage

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: brief description of changes"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Describe what your changes do
   - Reference any related issues
   - Ensure CI/CD checks pass

## Code Style Guidelines

### TypeScript

- Use TypeScript for all code
- Define types for all parameters and return values
- Use interfaces for complex types
- Add JSDoc comments for public functions

```typescript
/**
 * Description of what this function does
 * @param param1 Description of param1
 * @param param2 Description of param2
 * @returns Description of return value
 * @throws Description of potential errors
 */
export function myFunction(param1: string, param2: number): boolean {
  // Implementation
}
```

### Naming Conventions

- `camelCase` for variables, functions, and parameters
- `PascalCase` for classes, interfaces, and types
- `UPPER_SNAKE_CASE` for constants
- Descriptive names that indicate purpose

### Comments

- Add comments for complex logic
- Explain the "why", not just the "what"
- Keep comments up-to-date with code changes

## Testing

- Write unit tests for all functions
- Test both success and error cases
- Use descriptive test names: `should ...`
- Maintain good code coverage

```typescript
describe('functionName', () => {
  it('should do something specific', () => {
    // Test implementation
  });

  it('should handle error cases', () => {
    // Error test implementation
  });
});
```

## Commit Message Guidelines

Format: `<type>: <subject>`

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring without functional changes
- `test`: Adding or updating tests
- `chore`: Build, dependency, or tool changes

Examples:
```
feat: add support for HDwallet derivation
fix: correct base58 encoding checksum validation
docs: update README with transaction examples
test: add tests for address validation
```

## Pull Request Process

1. **Before submitting:**
   - Run `npm run build` - code must compile
   - Run `npm test` - all tests must pass
   - Run `npm run test:coverage` - check coverage

2. **PR Description should include:**
   - What changes were made and why
   - How to test the changes
   - Any breaking changes
   - Related issues (use `#issueNumber`)

3. **Review process:**
   - Project maintainers will review your PR
   - Address feedback and suggestions
   - Update PR based on review comments
   - PR will be merged once approved

## Reporting Issues

When reporting bugs or suggesting features:

1. **Check existing issues** - avoid duplicates
2. **Be specific** - include:
   - What you were trying to do
   - What happened
   - What you expected to happen
   - Error messages or code examples
   - Environment (Node version, OS, etc.)

3. **Include minimal reproduction** - provide a small code sample that demonstrates the issue

## Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for new functions
- Update CHANGELOG.md for significant changes
- Include examples for new features

## Areas to Contribute

### High Priority
- Proper secp256k1 cryptography implementation
- Enhanced transaction fee calculation
- Wallet backup and recovery features
- Hardware wallet support

### Medium Priority
- Additional blockchain network support
- More comprehensive error handling
- Performance optimizations
- Extended test coverage

### Low Priority
- Code refactoring
- Documentation improvements
- Example updates
- TypeScript definition improvements

## Questions?

Feel free to open an issue for questions or discussions about the project.

Thank you for contributing to TETSUO Wallet SDK!
