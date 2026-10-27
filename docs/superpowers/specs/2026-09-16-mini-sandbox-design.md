# MiniSandbox Design

## Problem

Large local tool results consume model context even when only a small part is relevant. MiniSandbox retains the complete result locally, returns only a bounded preview and handle, and lets the model retrieve relevant chunks on demand.

It optimizes model context. It is not an OS security boundary and does not promise to remove raw output from Codex UI, logs, or transcripts.

## Success criteria

Two production MVP paths must work:

1. `ctx_run -> ExecuteCommand -> StoreOutput -> handle + preview`
2. `Codex PreToolUse -> Rewrite Bash command -> MiniSandbox wrapper -> ExecuteCommand -> RouteCommandOutput -> Passthrough | StoreOutput`

Small wrapped-command results pass through unchanged. Oversized results are persisted and replaced before the next model request. Both paths produce the same records, handles, previews, and searchable chunks.

## Architecture

Entrypoints are separate protocol boundaries:

- the MCP server registers `ctx_run` and `ctx_query`;
- the Codex adapter translates hook events and decisions;
- the command wrapper executes rewritten Bash requests and renders routed results;
- the CLI exposes stats, purge, and reindex operations.

They share a host-neutral application core and infrastructure ports. No adapter calls another adapter, and the hook does not require the MCP server to be online.

### Application use cases

`StoreOutput(output) -> StoredOutput` owns raw persistence, handle creation, chunk derivation, FTS indexing, and preview generation. It always stores and never returns `Passthrough`.

`RouteCommandOutput(output) -> Passthrough | StoredOutput` serves only automatically wrapped commands. It measures captured UTF-8 bytes and calls `StoreOutput` only above the configured threshold.

`ExecuteCommand` captures command output and exit metadata without implementing persistence. `QueryOutput` applies session/handle filters, BM25 ordering, snippets, and the response budget.

## Codex lifecycle

MiniSandbox uses a synchronous Codex `PreToolUse` hook for native Bash calls. The adapter returns `updatedInput` that replaces the requested command with a MiniSandbox wrapper invocation while preserving the original command as wrapper input. The wrapper executes the original command, captures its real output and exit metadata, and becomes the producer of the result Codex sends to the model.

For output at or below the threshold, the wrapper reproduces the captured output. For oversized output it persists the result and prints a bounded response containing the handle and preview. Wrapper invocations are recognized and left unchanged to prevent recursive rewriting; MiniSandbox's own MCP tools are outside the Bash rewrite path.

The verified Codex contract is fail-open: if the `PreToolUse` hook process fails, Codex executes the original Bash command unchanged. The rewrite hook must therefore stay small and deterministic, and policy conditions that must stop execution require an explicit deny decision rather than a failed process. If wrapper persistence fails after command execution, it emits the captured original result instead of inventing a handle. Explicit `ctx_run` persistence failures return an MCP error and bounded emergency preview without inventing a handle.

## Storage and retrieval

Each project uses a persistent database under `~/.mini-sandbox/projects/<project-hash>/mini-sandbox.db`. Records are tagged with a Codex session id. Queries default to the MCP process's current session; an exact handle may address a historical session in the same project. Because Codex starts the project MCP server independently from `PreToolUse`, automatically wrapped Bash output is retrieved with the exact handle returned by the wrapper rather than an unscoped query.

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

The test pyramid contains domain unit tests, temporary-database integration tests, MCP contract tests, Codex adapter fixture tests, wrapper tests, and real Codex acceptance checks. Real acceptance must prove Bash-command rewriting, small-output passthrough, large-output replacement, later retrieval, recursive-rewrite prevention, MCP-server independence, and both hook and persistence fail-open behavior.

## MVP scope

Included: TypeScript, Node.js, stdio MCP, `ctx_run`, `ctx_query`, SQLite raw persistence, FTS5/BM25, bounded previews, project/session scoping, global configuration, the Codex PreToolUse adapter and command wrapper, stats/purge/reindex CLI operations, and tests.

Deferred: arbitrary JavaScript execution, other host adapters, OS sandboxing, embeddings, summarization, exact tokenization, conversation restoration, per-tool configuration, secret redaction, UI, and multi-gigabyte streaming.

## Learning boundary

The learner must understand MCP lifecycle, Codex hook timing, adapter/core separation, the two use-case boundary, SQLite transactions and WAL, FTS5/BM25, chunking, context budgets, session scoping, and failure semantics. Codex may provide scaffolding, CRUD boilerplate, schemas, fixtures, CLI parsing, and mechanical refactoring.
