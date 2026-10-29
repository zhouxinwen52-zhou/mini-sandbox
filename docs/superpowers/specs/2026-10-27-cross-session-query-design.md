# Cross-Session Query Design

## Status

Post-MVP proposal. This document describes future behavior and does not change the current MiniSandbox contract.

## Intent

Make `ctx_query` feel native in Codex: an unscoped query should search the current Codex chat without requiring the user or model to copy a handle, while deliberate selectors should support historical and project-wide retrieval.

The current MVP remains valid and supported. Automatically wrapped Bash output returns an exact handle, and `ctx_query` can retrieve that output by handle across sessions in the same project.

## Current limitation

Codex gives each `PreToolUse` hook invocation the real Codex `session_id`. The Bash wrapper therefore stores automatic output under the Codex chat session.

The project MCP server starts independently and does not receive that dynamic session ID. It currently creates a process-local session ID, so an unscoped `ctx_query` searches the MCP process session. This works naturally for `ctx_run`, but not for output stored by the Bash hook. Automatic retrieval consequently requires the exact handle returned by the wrapper.

Treating the most recently active hook session as current is not safe: concurrent Codex chats could overwrite shared state and query each other's records.

## Goals

- Make an unscoped `ctx_query` search the calling Codex chat session.
- Make `ctx_run` records use the calling Codex chat session when invoked from Codex.
- Preserve exact-handle retrieval across sessions in the same project.
- Support deliberate queries over multiple sessions, multiple handles, or the whole project.
- Let the model discover available historical sessions without reading the database directly.
- Preserve byte budgets, BM25 ordering, project isolation, and deterministic filtering.
- Remain usable from MCP clients that do not provide Codex hooks.

## Non-goals

- Automatically merging or summarizing sessions.
- Embeddings or semantic search.
- A graphical session browser.
- Inferring chat titles from unstable Codex transcript formats.
- Sharing data across projects.
- Using a mutable global "current session" file.

## Approaches considered

### 1. Shared current-session file

Each Bash hook could write its session ID to a file that the MCP server reads before a query. This is simple, but concurrent chats can race and silently query the wrong session. Rejected because correctness would depend on global mutable state.

### 2. Most-recent-session inference

The MCP server could treat the most recently written hook session as current. This avoids another file but has the same concurrency problem, and background or delayed commands make recency an unreliable identity signal. Rejected.

### 3. Inject the Codex session into MCP tool calls

Add a second synchronous `PreToolUse` hook matcher for MiniSandbox MCP tools. Codex supplies the live `session_id` to that hook, which adds it to `ctx_run` and `ctx_query` tool input when the caller has not explicitly selected another scope.

Selected because identity travels with each tool call, concurrent chats stay isolated, and no shared mutable state is required.

## Proposed lifecycle

### Current-session query

```text
Codex chat A
  -> model calls ctx_query({ query })
  -> PreToolUse for the MiniSandbox MCP tool receives session_id=A
  -> hook rewrites input to include sessionId=A
  -> MCP server queries project + session A
  -> bounded BM25 snippets return to Codex
```

### Explicit command execution

```text
Codex chat A
  -> model calls ctx_run({ command })
  -> PreToolUse injects sessionId=A
  -> MCP server executes and stores under session A
  -> later unscoped ctx_query searches the same session
```

### Historical query

```text
ctx_sessions({ limit: 20 })
  -> returns project-local session summaries
  -> model selects one or more session IDs
ctx_query({ query, sessionIds: [...] })
  -> searches only those sessions
```

## Tool contracts

### `ctx_query`

Proposed input:

```ts
interface QueryInput {
  query: string;
  scope?: "session" | "project";
  sessionIds?: string[];
  handles?: string[];
  limit?: number;
  sessionId?: string; // internal compatibility field injected by Codex hook
}
```

Filtering rules, in priority order:

1. `handles` limits results to those exact outputs.
2. `sessionIds` limits results to those sessions.
3. When both arrays are supplied, filters use intersection semantics.
4. `scope: "project"` removes the implicit current-session filter, but explicit handle and session filters still apply.
5. Otherwise, `scope` defaults to `"session"` and uses the hook-injected `sessionId`.
6. Outside Codex, when no session is injected, the MCP client keeps its process-local compatibility session.

Empty `handles` or `sessionIds` arrays are invalid rather than meaning "all". IDs must be deduplicated and bounded to a documented maximum so a single request cannot create an unbounded SQL predicate.

The public MCP description should present `scope`, `sessionIds`, and `handles` to the model. The singular `sessionId` exists for adapter-to-server propagation and should not be described as the normal user-facing selector.

### `ctx_run`

`ctx_run` accepts the same internal `sessionId` field. The Codex MCP-tool hook injects the current chat session unless the request already contains an adapter-approved value. Other clients retain the existing process-local session fallback.

### `ctx_sessions`

Proposed input:

```ts
interface SessionsInput {
  limit?: number;
  source?: "codex-bash" | "mcp";
  before?: string;
}
```

Proposed result fields:

```ts
interface SessionSummary {
  sessionId: string;
  sources: Array<"codex-bash" | "mcp">;
  outputCount: number;
  firstActivityAt: string;
  lastActivityAt: string;
  recentCommandPreview?: string;
}
```

Results are project-scoped and ordered by `lastActivityAt` descending. The command preview must be short and derived from tool input, not raw captured output. Pagination uses a stable cursor or timestamp boundary rather than an unbounded list.

## Hook adapter changes

Keep Bash rewriting and MCP session injection as separate behaviors, even if they share an executable entry point.

The project hook configuration adds a matcher for the registered MiniSandbox tool names. The adapter must:

- accept only `ctx_run` and `ctx_query` from the configured MiniSandbox server;
- copy the original tool input before adding `sessionId`;
- leave explicit project and historical selectors intact;
- avoid rewriting MiniSandbox-internal calls recursively; and
- fail open, preserving the original MCP tool input if normalization or rewriting fails.

Tests must use the exact tool names emitted by the installed Codex version rather than assuming a generic MCP naming convention.

## Storage and query behavior

No new output ownership model is required. Existing records already contain project ID, session ID, source, handle, timestamps, raw output, and FTS chunks.

The storage/query port must gain bounded multi-value filters. SQL should bind values rather than interpolate IDs. Query budgeting remains global across all matched sessions and handles, not per selector. BM25 remains the primary ranking; ties should use stable output/chunk ordering.

`ctx_sessions` may initially aggregate from `outputs` with indexed session and timestamp columns. A separate sessions table is unnecessary until measurement shows aggregation is too expensive.

## Safety and privacy

- Default scope remains the current session.
- Project-wide search must be explicit.
- Results must include session ID, handle, source, and timestamp so cross-session provenance is visible.
- Every query remains restricted to the current project database.
- Selector counts, result counts, and response bytes are bounded.
- Session discovery must never expose raw output previews.
- A shared mutable active-session pointer is prohibited.

## Compatibility

- Existing `{ query, handle, limit }` requests continue to work; the server normalizes singular `handle` to `handles: [handle]` during migration.
- Exact handles continue to cross session boundaries within the same project.
- Non-Codex MCP clients continue using their process-local session when no session ID is injected.
- The existing wrapper response remains unchanged, so older Codex sessions can continue querying by handle.

## Delivery sequence

1. **Codex session bridge:** inject the live Codex session into `ctx_run` and unscoped `ctx_query`; prove isolation with two simulated concurrent sessions.
2. **Session discovery:** add `ctx_sessions` with bounded project-local summaries and pagination.
3. **Multi-selector query:** add `sessionIds`, `handles`, intersection semantics, provenance, and selector limits.
4. **Project scope:** add explicit `scope: "project"`, cross-session ranking tests, and privacy documentation.
5. **Optional enhancements:** evaluate embeddings, summaries, and UI only after measuring FTS retrieval quality and real usage.

Each step should remain a separate feature branch and reviewable commit sequence.

## Acceptance criteria

- Two concurrent Codex sessions can issue unscoped queries without reading each other's records.
- `ctx_run` and automatic Bash output from the same Codex chat are discoverable by an unscoped query.
- Exact handles still retrieve historical output in the same project.
- Multiple session and handle filters use documented intersection semantics.
- Project scope is opt-in and returns visible provenance for every result.
- `ctx_sessions` is bounded, ordered, and does not expose raw output.
- Existing clients and current exact-handle workflows remain compatible.
- Type checking, unit tests, integration tests, MCP contract tests, and real Codex acceptance all pass.
