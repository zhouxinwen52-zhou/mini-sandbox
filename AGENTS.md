# MiniSandbox Learning Workflow

This repository is both a production-oriented project and a hands-on learning project. Optimize for understanding without losing practical delivery momentum.

## Planning by day and feature

- Before starting a new project phase, turn the roadmap into a short sequence of day-sized features.
- Each day must have one clear outcome, a checkpoint that can be demonstrated, and a reasonably small Git diff.
- Explain how the current day's feature connects to the previous and following days.
- Do not implement work assigned to a later day unless it is strictly required by the current feature. If that happens, explain why first.
- Treat the existing roadmap, architecture document, and implementation plan as the source of truth. Discuss meaningful deviations before implementation.

## Learning pace

- Work in medium-sized learning steps: one concept or one coherent behavior at a time.
- Do not implement an entire day in one uninterrupted batch.
- Do not stop after every mechanical edit. A normal step should include a short explanation, a failing test when behavior changes, the minimum implementation, and verification.
- After each step, explain the data flow, the responsibility of the new component, and the files changed. Then allow time for questions or review before starting the next concept.
- Prefer plain language and concrete examples. Introduce terminology only when it helps explain the code.
- Ask short understanding questions at important architectural boundaries, not after every line of code.
- The learner may ask Codex to write the code. Learning comes from staged implementation, explanation, tests, and review rather than requiring the learner to type every line.

## Implementation workflow

For each coherent behavior:

1. State the immediate goal and its place in the larger data flow.
2. Write or update a focused test first when production behavior changes.
3. Run the test and confirm the expected failure.
4. Implement only enough production code to satisfy the current behavior.
5. Run focused tests, then proportionate project verification.
6. Summarize what changed and why.
7. Open the Codex Review view and wait for learner feedback before moving to a commit.

Documentation-only and type-contract changes may use type checking or another appropriate verification instead of forcing a runtime test.

## Review and commit gate

- Never commit automatically after generating code.
- Keep completed changes in the working tree until the learner has reviewed them.
- Before review, list every changed file and give one sentence describing its purpose.
- Open a Review view scoped to the current step. Avoid mixing earlier completed work into the review when a narrower comparison is available.
- Commit only after the learner explicitly says to commit the reviewed changes.
- A request to continue implementation is not permission to commit.
- Before committing, verify that the staged files match the reviewed scope and run the relevant checks again.

## Git and pull request practice

- Do feature work on a dedicated branch, not directly on `main`.
- Use descriptive lowercase branch names. Prefer the repository convention `codex/<feature>` unless the learner explicitly chooses another name.
- Keep commits small, coherent, and independently understandable. One learning step may be one commit when it forms a complete behavior.
- Use Conventional Commit-style messages such as `feat: add SQLite output store` or `test: cover failed command persistence`.
- Do not combine unrelated refactors, formatting, or future-day work with the current feature.
- Before creating a pull request, run the full relevant test, type-check, and build commands; review the branch diff against its base.
- Present the proposed PR title and summary for review before creating or publishing the PR.
- Never push, merge, or publish a pull request without explicit learner approval.

## Step completion format

At the end of each implementation step, report:

- the behavior now supported;
- the files changed;
- the focused and full verification results;
- what remains for the current day;
- whether the working tree is uncommitted or which commit was explicitly approved.

When the learner says the explanation is unclear, pause implementation and explain the current concept with a concrete example before continuing.
