# Contributing to esmap

Thank you for your interest in contributing to esmap! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Commit Convention](#commit-convention)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Adding a Changeset](#adding-a-changeset)
- [Testing](#testing)
- [Coding Standards](#coding-standards)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 22 (see `.nvmrc`)
- [pnpm](https://pnpm.io/) >= 10

### Setup

```bash
git clone https://github.com/niceplugin/esmap.git
cd esmap
pnpm install
pnpm build
```

### Verify everything works

```bash
pnpm test        # Run all unit tests
pnpm type-check  # TypeScript validation
pnpm lint        # Lint all packages
```

## Project Structure

esmap is a monorepo managed with [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/).

```
esmap/
├── packages/
│   ├── runtime/        # Import map loader, app registry, router
│   ├── react/          # React adapter and hooks
│   ├── communication/  # Event bus, global state
│   ├── sandbox/        # JS isolation (proxy + snapshot)
│   ├── guard/          # CSS scoping, style isolation
│   ├── devtools/       # Import map override for development
│   ├── monitor/        # Performance tracking
│   ├── cli/            # CLI — generate, deploy, rollback
│   ├── vite-plugin/    # Vite plugin — manifest, externals
│   ├── server/         # Import map server — deploy API
│   ├── config/         # Configuration schema and loading
│   ├── compat/         # Migration layer (Module Federation → import maps)
│   ├── core/           # Core orchestration
│   ├── shared/         # Shared types, errors, utilities
│   └── test/           # Test utilities, mock apps, matchers
├── examples/
│   ├── basic/          # Import map generation pipeline
│   ├── multi-mfe/      # Browser routing + dynamic loading
│   └── enterprise-platform/
├── turbo.json          # Turborepo task pipeline
├── eslint.config.js    # ESLint flat config
└── vitest.workspace.ts # Vitest workspace config
```

**Dependency direction:** `react` → `runtime` → `shared`. Packages like `sandbox`, `guard`, `communication`, `monitor` have zero internal dependencies.

## Development Workflow

### Working on a single package

```bash
# Build only the package you're working on (and its dependencies)
pnpm turbo build --filter=@esmap/runtime

# Run tests for a single package
pnpm turbo test --filter=@esmap/runtime

# Watch mode for tests
cd packages/runtime
pnpm test:watch
```

### Running examples

```bash
# Basic example
cd examples/basic && pnpm demo

# Multi-MFE example with browser routing
cd examples/multi-mfe && pnpm dev
```

### Think before adding a dependency

esmap aims to keep browser packages minimal. Before adding a new dependency:

- Could the functionality be implemented in a few lines of code?
- Does the dependency have its own large dependency tree?
- Is it tree-shakeable?
- For browser packages: what is the gzip size impact?

If the answer to the first question is yes, prefer implementing it yourself.

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/). See [`.github/commit-convention.md`](./.github/commit-convention.md) for the full specification.

Each commit message must follow this format:

```
<type>(<scope>): <description>

[optional body]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

**Scope** is the package name without the `@esmap/` prefix (e.g., `runtime`, `react`, `cli`).

**Examples:**

```
feat(runtime): add prefetch strategy for idle-time loading
fix(runtime): prevent stale mount on rapid navigation
docs: update quick start guide
test(sandbox): add proxy revocation edge cases
chore: update TypeScript to 5.7
```

## Pull Request Guidelines

### Before submitting

1. **Create a feature branch** from `main`:

   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make sure all checks pass:**

   ```bash
   pnpm type-check
   pnpm test
   pnpm lint
   pnpm format:check
   ```

3. **Keep PRs focused.** One logical change per PR. If you find unrelated issues, open a separate PR.

### PR requirements

- Follow the [PR template](./.github/pull_request_template.md).
- PR title must follow [Conventional Commits](#commit-convention) format (we squash-merge).
- Add or update tests for any code changes.
- Ensure no type errors, lint errors, or test failures.
- For new features, update relevant documentation or examples.

### Review process

1. A maintainer will review your PR.
2. Address feedback by pushing new commits (do not force-push during review).
3. Once approved, a maintainer will squash-merge your PR.

## Adding a Changeset

If your PR changes the behavior of any published package (`packages/*`), you need to include a changeset:

```bash
pnpm changeset
```

Follow the prompts to:

1. Select the affected package(s).
2. Choose the semver bump type (`patch`, `minor`, `major`).
3. Write a concise description of the change (this appears in the CHANGELOG).
4. Commit the generated `.changeset/*.md` file with your PR.

Not every PR needs a changeset — skip it for docs-only, test-only, CI, or example changes. See [RELEASE.md](./RELEASE.md) for the full release policy.

## Testing

We use [Vitest](https://vitest.dev/) for all unit testing.

### Running tests

```bash
# All tests
pnpm test

# Single package
pnpm turbo test --filter=@esmap/sandbox

# Watch mode (from package directory)
cd packages/sandbox
pnpm test:watch

# With coverage
pnpm turbo test --filter=@esmap/sandbox -- --coverage
```

### Writing tests

- Every new feature or bug fix should include tests.
- Place test files next to the source: `foo.ts` → `foo.spec.ts`.
- Use the test utilities from `@esmap/test` for mock apps, test registries, and custom matchers.
- Tests should be deterministic — no reliance on timing, network, or global state leakage.

## Coding Standards

### TypeScript

- **Strict mode** is enabled — no `any` unless absolutely necessary.
- Use `type` imports: `import type { Foo } from './foo'`.
- Follow the existing patterns in the package you're modifying.

### Formatting

- [Prettier](https://prettier.io/) handles all formatting. Run `pnpm format` before committing.
- [EditorConfig](https://editorconfig.org/) is configured — most editors pick this up automatically.

### Linting

- [ESLint](https://eslint.org/) with TypeScript rules. Run `pnpm lint` to check.
- Do not add `eslint-disable` comments. Fix the underlying issue instead.

## Reporting Issues

### Bug reports

Use the [bug report template](https://github.com/niceplugin/esmap/issues/new?template=bug_report.yml). Please include:

- A **minimal reproduction** (repository link or code snippet).
- Expected vs. actual behavior.
- Environment details (Node.js version, OS, browser).

### Feature requests

Use the [feature request template](https://github.com/niceplugin/esmap/issues/new?template=feature_request.yml). Please explain:

- The **problem** you're trying to solve (not just the solution you want).
- Any alternatives you've considered.

### Questions

For general questions, use [GitHub Discussions](https://github.com/niceplugin/esmap/discussions) instead of opening an issue.

---

Thank you for contributing to esmap!
