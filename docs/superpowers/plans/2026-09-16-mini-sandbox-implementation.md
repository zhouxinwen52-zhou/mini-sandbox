# MiniSandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Use TDD and review checkpoints.

**Goal:** Build a working learning-focused MCP server and Codex hook adapter that persist oversized tool output and expose bounded retrieval.

**Architecture:** Separate MCP, Codex-hook, command-wrapper, and CLI entrypoints depend on a host-neutral core. Explicit execution calls `StoreOutput` directly; automatic interception rewrites native Bash input to the wrapper, which executes the original command and routes its captured output by actual byte size.

**Tech Stack:** TypeScript, Node.js 22+, MCP TypeScript SDK v2 (`@modelcontextprotocol/server` and test-only `@modelcontextprotocol/client`), Zod, `better-sqlite3` with FTS5, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-16-mini-sandbox-design.md`

## Global constraints

- Context/output sandbox only; no OS security claim.
- Codex is the only MVP hook host.
- Use the wrapper's captured output byte size for automatic routing.
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

Probe the installed Codex version with project-local hooks and sanitized real fixtures. Disprove PostToolUse model-visible replacement, verify `PreToolUse.updatedInput` Bash rewriting, and verify that a failed PreToolUse hook executes the original command unchanged.

Checkpoint: evidence shows exactly what the next model request receives.

### Day 8: Bash rewrite adapter and command wrapper

Implement Codex event normalization, guarded Bash-command rewriting, recursive-rewrite prevention, and a wrapper that executes the original command and preserves output plus exit metadata. Route captured output by actual UTF-8 byte size, encode StoredOutput responses, and cover malformed input and persistence fail-open behavior with fixture and wrapper tests.

Checkpoint: a rewritten Bash call preserves small output unchanged, while only output above the configured threshold is stored and replaced with a bounded handle plus preview.

### Day 9: Real Codex integration

First replace the Day 7 probe rewrite with the production PreToolUse entry point, wiring event normalization and guarded Bash rewriting to the real command wrapper. Then use only the repository's project-local hook configuration and run the real Codex acceptance matrix for rewrite activation, small output, large output, retrieval, hook failure, database failure, MCP-server-offline behavior, recursion prevention, exit-status preservation, and concurrent DB access.

Checkpoint: an ordinary Codex terminal command runs through the MiniSandbox wrapper instead of returning the Day 7 probe marker, and both explicit and automatic paths work in a real Codex session.

### Day 10: Documentation and teach-back

Finish installation and removal guidance, architecture and data-flow documentation, environment checks, a byte-savings benchmark, and the full test suite.

Checkpoint: a fresh setup follows the README successfully, and the learner can explain the architecture and every failure path without reading the code.

## Post-MVP roadmap

The approved direction for current-session, historical-session, multi-handle, and project-wide retrieval is documented in [Cross-Session Query Design](../specs/2026-10-27-cross-session-query-design.md). It remains outside the ten-day MVP and does not block Day 10 completion.

## Final MVP acceptance

- Build, typecheck, unit, integration, and MCP contract tests pass.
- A real Codex session passes the acceptance matrix.
- `ctx_run` always stores and returns a valid handle on successful persistence.
- a native Bash request is rewritten to the MiniSandbox wrapper before execution.
- wrapped command output at or below threshold passes through unchanged.
- wrapped command output above threshold is stored and replaced for the model.
- a failed rewrite hook executes the original Bash command, and a wrapper persistence failure does not invent a handle.
- `ctx_query` retrieves budgeted BM25-ranked snippets.
- database failure produces observable automatic fail-open behavior.
- documentation clearly states limitations and design decisions.
