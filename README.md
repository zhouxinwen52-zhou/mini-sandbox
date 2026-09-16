# MiniSandbox

MiniSandbox is a learning-focused MCP project for keeping large tool outputs out of a model's working context while preserving the complete local result for later retrieval.

It is inspired by the architecture and engineering ideas behind [context-mode](https://github.com/mksglu/context-mode), but it is an independent, smaller design rather than a source-code copy.

## Intended MVP

- An explicit `ctx_run` MCP tool that executes a command, stores the complete output, and returns a bounded preview plus a stable handle.
- A `ctx_query` MCP tool backed by SQLite FTS5 and BM25 retrieval.
- A Codex `PostToolUse` adapter that measures the actual output size and replaces oversized model-visible results with a handle and preview.
- Project-persistent, session-tagged SQLite storage.
- Configurable byte budgets and observable fail-open behavior.

MiniSandbox is a **context/output sandbox**, not an operating-system security sandbox. Commands run with the permissions of the user who starts the process.

## Learning goals

The project is designed to build a practical understanding of:

- MCP server lifecycle and tool registration;
- Codex hook lifecycle and model-visible output interception;
- host adapters and application-core boundaries;
- SQLite persistence, FTS5, and BM25 retrieval;
- handle-and-preview context budgeting;
- session scoping, failure behavior, and testable architecture.

## Status

Architecture and implementation planning are complete. Feature implementation has not started.

See:

- [Architecture design](docs/superpowers/specs/2026-09-16-mini-sandbox-design.md)
- [Implementation plan](docs/superpowers/plans/2026-09-16-mini-sandbox-implementation.md)
