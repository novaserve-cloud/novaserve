# Contributing to NovaServe

Thank you for your interest in contributing to NovaServe!

## Development Setup

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/novaserve-cloud/novaserve.git
   cd novaserve
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Build the packages**:
   ```bash
   pnpm build
   ```

4. **Run the test suite**:
   ```bash
   pnpm test
   ```

5. **Validate package integrity**:
   ```bash
   pnpm validate:package
   ```

## Pull Request Guidelines

- Ensure tests pass with `pnpm test`.
- Verify types with `pnpm typecheck`.
- Never submit fake or empty tests.
- Add meaningful unit tests for any new features or bug fixes.
- Follow existing coding style and commit message conventions.
