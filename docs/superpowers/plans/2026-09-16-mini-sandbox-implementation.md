# MiniSandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Use TDD and review checkpoints.

**Goal:** Build a working learning-focused MCP server and Codex hook adapter that persist oversized tool output and expose bounded retrieval.

**Architecture:** Separate MCP, Codex-hook, and CLI entrypoints depend on a host-neutral core. Explicit execution calls `StoreOutput` directly; automatic interception routes on actual output size before calling it.

**Tech Stack:** TypeScript, Node.js 22+, MCP TypeScript SDK v2 (`@modelcontextprotocol/server` and test-only `@modelcontextprotocol/client`), Zod, `better-sqlite3` with FTS5, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-16-mini-sandbox-design.md`

## Global constraints

- Context/output sandbox only; no OS security claim.
- Codex is the only MVP hook host.
- Use actual PostToolUse output size for automatic routing.
- Defaults: threshold 10 KiB, preview 2 KiB, query response 4 KiB.
- Raw records are authoritative; FTS chunks are rebuildable.
- Automatic hook failures fail open.
- No implementation may be copied from context-mode.

## Ten-day learning sequence

### Day 1: Minimal MCP server

Create the TypeScript/test setup and a stdio MCP server with a fixed-response `ctx_run`. Verify initialization, tool listing, valid calls, schema failures, and stdout protocol purity.

Checkpoint: an MCP client can discover and call exactly one tool.

### Day 2: Command execution and budgets

Define `CapturedOutput`, `ExecuteCommand`, UTF-8 byte measurement, and bounded head-and-tail previews. Test success, stderr, non-zero exit, multi-byte text, and boundary sizes.

Checkpoint: a real command produces a preview that never exceeds its budget.

### Day 3: SQLite and StoreOutput

Add project-scoped SQLite storage, output records, stable handles, the storage port, and `StoreOutput`. Change `ctx_run` to execute and unconditionally store every result.

Checkpoint: raw output can be retrieved exactly by handle, including a failed command.

### Day 4: Chunking and FTS5 indexing

Add the line-aware UTF-8-safe chunker, FTS5 schema, atomic record/index writes, rollback coverage, and reindexing from raw records.

Checkpoint: deleting and rebuilding the derived index preserves searchability.

### Day 5: ctx_query and BM25

Register `ctx_query`; implement current-session filtering, optional handle filtering, FTS5 MATCH, ascending BM25 ranking, snippets, and total query budgeting.

Checkpoint: a query retrieves relevant middle content absent from the original preview.

### Day 6: Configuration and CLI operations

Add global JSON configuration, validation, project-root detection, WAL and busy timeout, local diagnostics, and stats/purge/reindex CLI operations.

Checkpoint: invalid configuration is field-specific, purge is complete, and two connections can perform basic writes.

### Day 7: Codex hook contract probe

Build a minimal synchronous PostToolUse probe and capture sanitized real fixtures. Verify passthrough, `continue:false`, failure, model-visible replacement, and UI/transcript differences against the installed Codex version.

Checkpoint: evidence shows exactly what the next model request receives.

### Day 8: RouteHookOutput and Codex adapter

Implement actual-byte routing, Codex event normalization, StoredOutput response encoding, own-tool exclusion, malformed-input fail-open, and fixture tests.

Checkpoint: only output above the configured threshold is stored and replaced.

### Day 9: Real Codex integration

Install the hook locally and run the acceptance matrix for small output, large output, retrieval, database failure, MCP-server-offline behavior, recursion prevention, and concurrent DB access.

Checkpoint: both explicit and automatic paths work in a real Codex session.

### Day 10: Documentation and teach-back

Finish installation and removal guidance, architecture and data-flow documentation, environment checks, a byte-savings benchmark, and the full test suite.

Checkpoint: a fresh setup follows the README successfully, and the learner can explain the architecture and every failure path without reading the code.

## Final MVP acceptance

- Build, typecheck, unit, integration, and MCP contract tests pass.
- A real Codex session passes the acceptance matrix.
- `ctx_run` always stores and returns a valid handle on successful persistence.
- native tool output at or below threshold passes through unchanged.
- native tool output above threshold is stored and replaced for the model.
- `ctx_query` retrieves budgeted BM25-ranked snippets.
- database failure produces observable automatic fail-open behavior.
- documentation clearly states limitations and design decisions.
