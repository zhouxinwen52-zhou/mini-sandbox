# MiniSandbox Design

## Problem

Large local tool results consume model context even when only a small part is relevant. MiniSandbox retains the complete result locally, returns only a bounded preview and handle, and lets the model retrieve relevant chunks on demand.

It optimizes model context. It is not an OS security boundary and does not promise to remove raw output from Codex UI, logs, or transcripts.

## Success criteria

Two production MVP paths must work:

1. `ctx_run -> ExecuteCommand -> StoreOutput -> handle + preview`
2. `Codex PostToolUse -> RouteHookOutput -> Passthrough | StoreOutput`

Small native-tool results pass through unchanged. Oversized results are persisted and replaced before the next model request. Both paths produce the same records, handles, previews, and searchable chunks.

## Architecture

Entrypoints are separate protocol boundaries:

- the MCP server registers `ctx_run` and `ctx_query`;
- the Codex adapter translates hook events and decisions;
- the CLI exposes stats, purge, and reindex operations.

They share a host-neutral application core and infrastructure ports. No adapter calls another adapter, and the hook does not require the MCP server to be online.

### Application use cases

`StoreOutput(output) -> StoredOutput` owns raw persistence, handle creation, chunk derivation, FTS indexing, and preview generation. It always stores and never returns `Passthrough`.

`RouteHookOutput(output) -> Passthrough | StoredOutput` serves only automatic hooks. It measures actual UTF-8 bytes and calls `StoreOutput` only above the configured threshold.

`ExecuteCommand` captures command output and exit metadata without implementing persistence. `QueryOutput` applies session/handle filters, BM25 ordering, snippets, and the response budget.

## Codex lifecycle

MiniSandbox uses a synchronous Codex `PostToolUse` hook. The adapter receives the actual `tool_response` after execution but before the normal tool result is sent to the next model request.

For oversized output it persists the result and returns `continue: false` with a bounded `stopReason` containing the handle and preview. Unsupported replacement fields such as `updatedMCPToolOutput` are not used. MiniSandbox's own MCP tools are excluded to prevent recursive interception.

Automatic hook failures are observable and fail open: the original result proceeds normally. Explicit `ctx_run` persistence failures return an MCP error and bounded emergency preview without inventing a handle.

## Storage and retrieval

Each project uses a persistent database under `~/.mini-sandbox/projects/<project-hash>/mini-sandbox.db`. Records are tagged with a Codex session id. Queries default to the current session; an exact handle may address a historical session in the same project.

The `outputs` table is the source of truth. It stores the stable handle, scope and source metadata, tool input, raw output, available execution metadata, byte count, and timestamp.

An FTS5 virtual table stores derived, ordered text chunks. The line-aware chunker targets roughly 4 KiB, preserves UTF-8 boundaries, splits very long lines safely, and overlaps a small number of lines. The index is rebuildable from raw records.

`ctx_query({ query, handle?, limit? })` uses FTS5 `MATCH`, ascending `bm25()` relevance, highlighted snippets, and a total response byte budget.

## Configuration

Global configuration lives at `~/.mini-sandbox/config.json` with defaults:

- `thresholdBytes`: 10 KiB
- `previewBytes`: 2 KiB
- `queryBudgetBytes`: 4 KiB

The first version does not support per-tool or per-project overrides. Values are validated as bounded positive integers, and preview size must be below the interception threshold.

## Persistence and concurrency

Raw record and FTS rows commit atomically. Pure chunk and preview computation occurs before the write transaction. SQLite uses WAL, a busy timeout, and short transactions so the long-lived MCP process and short-lived hook processes can share the database.

## Testing

The test pyramid contains domain unit tests, temporary-database integration tests, MCP contract tests, Codex adapter fixture tests, and real Codex acceptance checks. Real acceptance must prove small-output passthrough, large-output replacement, later retrieval, recursive-tool exclusion, MCP-server independence, and fail-open behavior.

## MVP scope

Included: TypeScript, Node.js, stdio MCP, `ctx_run`, `ctx_query`, SQLite raw persistence, FTS5/BM25, bounded previews, project/session scoping, global configuration, the Codex PostToolUse adapter, stats/purge/reindex CLI operations, and tests.

Deferred: arbitrary JavaScript execution, other host adapters, OS sandboxing, embeddings, summarization, exact tokenization, conversation restoration, per-tool configuration, secret redaction, UI, and multi-gigabyte streaming.

## Learning boundary

The learner must understand MCP lifecycle, Codex hook timing, adapter/core separation, the two use-case boundary, SQLite transactions and WAL, FTS5/BM25, chunking, context budgets, session scoping, and failure semantics. Codex may provide scaffolding, CRUD boilerplate, schemas, fixtures, CLI parsing, and mechanical refactoring.
