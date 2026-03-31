# Commit Convention

esmap uses [Conventional Commits](https://www.conventionalcommits.org/).

Since we squash-merge PRs, **the PR title** is what matters — it becomes the final commit message on `main`.

## Format

```
<type>(<scope>): <description>
```

### Type

| Type | Description |
| --- | --- |
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Formatting, missing semi colons, etc. (no code change) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | A code change that improves performance |
| `test` | Adding or updating tests |
| `build` | Changes to the build system or dependencies |
| `ci` | Changes to CI configuration |
| `chore` | Other changes that don't modify src or test files |
| `revert` | Reverts a previous commit |

### Scope

The scope is the package name **without** the `@esmap/` prefix:

- `runtime`, `react`, `cli`, `server`, `sandbox`, `guard`, `communication`, `devtools`, `monitor`, `vite-plugin`, `config`, `compat`, `core`, `shared`, `test`

Scope is optional — omit it for changes that span multiple packages or affect the repo root.

### Description

- Start with a lowercase letter.
- Do not end with a period.
- Use imperative mood ("add feature" not "added feature").

## Validation Regex

```
/^(revert: )?(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+\))?!?: .+/
```

## Examples

```
feat(runtime): add prefetch strategy for idle-time loading
fix(runtime): prevent stale mount on rapid navigation
fix(sandbox): handle proxy revocation on unmount
docs: update quick start guide
test(guard): add CSS scoping edge cases
refactor(server): extract storage adapter interface
perf(runtime): lazy-load import map parser
build: update TypeScript to 5.7
ci: add Windows to test matrix
chore: clean up unused dev dependencies
```

## Breaking Changes

For breaking changes, add `!` after the type/scope:

```
feat(runtime)!: change loadImportMap return type
```

Or include `BREAKING CHANGE:` in the commit body.
