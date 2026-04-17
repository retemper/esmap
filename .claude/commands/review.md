Review the current branch's changes against the base branch (`main`).

## Steps

1. Run `git diff main...HEAD` to get all changes in this branch.
2. Perform a standard code review:
   - Correctness, bugs, edge cases
   - Code style and consistency
   - Security concerns
   - Performance issues
   - Test coverage (are new/changed features tested?)
3. **Documentation check**: For every changed package under `packages/`, check whether the corresponding docs need updating:
   - `docs/api/<package>.md` — API reference (EN)
   - `docs/guide/<package>.md` — Guide (EN)
   - `docs/ko/api/<package>.md` — API reference (KO)
   - `docs/ko/guide/<package>.md` — Guide (KO)
   - If a public API was added, changed, or removed but the docs were **not** updated, flag it explicitly.
   - If docs were updated, verify they accurately reflect the code changes.
4. Summarize findings in a clear, actionable format:
   - **Code issues** (if any)
   - **Missing doc updates** (if any)
   - **Overall assessment**
