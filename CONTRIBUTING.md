# Contributing to AI Agent Command Center

Thank you for your interest in contributing to **AI Agent Command Center**! We welcome bug reports, architecture improvements, security reviews, and optimizations.

---

## 🧭 Code of Conduct

Please treat all maintainers, contributors, and users with respect, professionalism, and collaboration.

---

## 🛠️ Development Workflow

### 1. Branch Strategy
- Work on a feature or fix branch cut from `main`:
  ```bash
  git checkout -b fix/your-fix-name
  # or
  git checkout -b feat/your-feature-name
  ```

### 2. Code Quality & Standards
- **TypeScript Strictness**: Ensure all new modules pass strict TypeScript compilation (`npm run build`).
- **Defensive Programming**:
  - Always use parameterized queries for database operations (`pool.query($1, ...)`).
  - Clean up client connections in `finally` blocks when using `pool.connect()`.
  - Validate and sanitize external input and URLs.
  - Implement unmount cleanup for event listeners and intervals.
- **Documentation**: Preserve existing comments and docstrings. Document new services with JSDoc headers.

### 3. Testing Requirements
Before submitting a pull request, you **must** ensure that all tests pass:
```bash
# Run server test suite
cd server
npm test

# Build frontend and backend
npm run build
cd ../client
npm run build
```

We enforce a **Zero-Regression Policy**: existing test files must not break, and new functionality or bug fixes must include unit or integration test coverage.

---

## 📝 Commit Convention

We follow conventional commits:
- `feat(scope)`: A new feature
- `fix(scope)`: A bug fix
- `perf(scope)`: A code change that improves performance or index utilization
- `sec(scope)`: A security hardening or vulnerability fix
- `docs(scope)`: Documentation changes only
- `test(scope)`: Adding missing tests or correcting existing tests

---

## 🚀 Submitting a Pull Request

1. Push your branch to GitHub.
2. Open a Pull Request against `main`.
3. Provide a clear description of the problem solved, design decisions, and verification steps.
4. Verify that the GitHub Actions CI workflow passes completely.
