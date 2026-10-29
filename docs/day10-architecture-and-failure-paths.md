# Day 10 Architecture and Failure Paths

## Outcome

MiniSandbox has two ways to capture command output, but both converge on the
same storage use case. The separation keeps Codex-specific protocols at the
edge and makes persistence, previewing, and retrieval independently testable.

MiniSandbox reduces model-visible output. It is not an operating-system
sandbox, and it does not claim to remove raw output from Codex UI, logs, or
transcripts.

## Component responsibilities

| Component | Owns | Does not own |
| --- | --- | --- |
| MCP server | `ctx_run` and `ctx_query` schemas and MCP responses | Hook events, shell rewriting, or SQL details |
| Codex `PreToolUse` adapter | Codex event normalization and guarded Bash input rewriting | Command execution or persistence |
| Bash wrapper | Execution of the rewritten command and rendering of routed output | MCP lifecycle |
| `ExecuteCommand` | Captured stdout, stderr, combined raw output, exit code, and signal | Threshold decisions or storage |
| `RouteCommandOutput` | Automatic-path threshold decision | Command execution or record construction |
| `StoreOutput` | Handle creation, UTF-8 byte count, preview creation, and save request | Host protocols |
| SQLite store | Atomic raw-record and FTS-chunk writes, search, stats, purge, and reindex | Preview policy or MCP formatting |
| CLI | Local `stats`, `purge`, and `reindex` operations | Codex or MCP request handling |

The important boundary is that entrypoint adapters depend on the application
core; adapters do not call one another. In particular, the Codex hook does not
call the MCP server. This is why automatic Bash interception continues to work
when the MCP server is offline.

## Flow 1: explicit `ctx_run`

```text
model
  -> MCP ctx_run({ command })
  -> ExecuteCommand
       -> stdout + stderr + rawOutput + exitCode + signal
  -> StoreOutput (always store)
       -> handle + UTF-8 byte count + bounded preview
       -> SQLite transaction
            -> authoritative outputs row
            -> derived FTS5 chunks
  <- MCP response: handle + byte count + exit code + preview
```

`ctx_run` is explicit, so it stores every captured result regardless of size.
A non-zero command exit is still a valid captured result: the output and exit
metadata are persisted and a handle is returned if storage succeeds.

## Flow 2: automatic native Bash interception

```text
Codex native Bash request
  -> synchronous PreToolUse hook
       -> normalize event
       -> reject non-Bash, malformed, empty, or already wrapped input
       -> Base64-encode original command
       -> updatedInput points to Bash wrapper
  -> Bash wrapper
       -> ExecuteCommand(original command)
       -> RouteCommandOutput measures actual captured UTF-8 bytes
            -> at or below threshold: original stdout/stderr
            -> above threshold: StoreOutput -> JSON handle + preview
  <- Codex receives wrapper result for the next model request
```

The threshold decision happens after the original command runs and uses the
captured output, not an estimate based on the command text. The marker
`MINI_SANDBOX_WRAPPED=1` prevents a wrapper command from being rewritten
again. The wrapper also preserves the original exit code or signal after it
prints the routed result.

## Retrieval flow

```text
model
  -> MCP ctx_query({ query, handle? })
  -> QueryOutput
       -> SQLite FTS5 MATCH
       -> project/session filter, or exact-handle filter
       -> ascending BM25 score with stable tie ordering
       -> highlighted snippets
       -> one total UTF-8 response budget
  <- bounded relevant text
```

Without a handle, `ctx_query` searches the MCP process's current session. An
exact handle may retrieve output from another session in the same project.
This matters because the Codex hook receives the live chat session ID while
the independently started MCP server has its own process session ID.
Automatically stored Bash output therefore uses the exact handle printed by
the wrapper. Removing that requirement is deliberately post-MVP work.

## Storage ownership and concurrency

Each normalized project root hashes to its own database under
`~/.mini-sandbox/projects/<project-hash>/mini-sandbox.db`.

The `outputs` table is authoritative. FTS5 chunks are derived from raw output
and can be deleted and rebuilt. Saving a record and all its chunks happens in
one SQLite transaction, so an indexing failure rolls back the raw record and
any chunks already inserted by that save.

SQLite uses WAL mode, a 5-second busy timeout, and short transactions so the
long-lived MCP server and short-lived wrapper processes can share a project
database. Reindex computes chunks outside its write transaction, verifies that
its input snapshot is still current inside an immediate transaction, and
retries up to three times if concurrent writes changed the record set.

## Failure-path matrix

| Failure | Observable result | Why this is safe for the MVP |
| --- | --- | --- |
| Hook process fails or emits no decision | Codex executes the original Bash input unchanged | Automatic interception fails open instead of blocking ordinary commands |
| Hook receives malformed, unsupported, empty, or already wrapped input | No rewrite decision | Invalid input is not transformed; recursion is avoided |
| Original command exits non-zero | Output plus exit metadata are captured; wrapper preserves the status | Command failure is data, not a MiniSandbox storage failure |
| Wrapper configuration or database setup fails after execution | Original captured stdout/stderr and original status are returned | No handle is invented for output that was not stored |
| Automatic storage fails | Original captured stdout/stderr are returned | The caller still sees the real command result |
| `ctx_run` storage fails | MCP error with `storage failed`, exit code, and bounded emergency preview; no handle | Explicit persistence failure stays visible and does not claim success |
| MCP server is offline | Native Bash rewriting and wrapper storage still work; `ctx_run`/`ctx_query` are unavailable | The hook path has no MCP runtime dependency |
| FTS query syntax is invalid | MCP error with bounded `query failed` text | Query failure does not damage stored raw output |
| FTS chunks are missing or stale | `reindex` rebuilds them from `outputs` | Derived search data can be discarded without losing the source of truth |
| Concurrent writes keep changing records during reindex | Reindex retries, then returns a visible error after three changed snapshots | It does not silently publish an index from an inconsistent snapshot |

Fail-open behavior applies to automatic output routing because the original
command has already run and its result should not disappear. It does not mean
that every error is hidden: explicit MCP operations and maintenance commands
return visible failures.

## Teach-back checkpoint

The architecture is understood when the learner can answer these without
opening the source code:

1. Why does `ctx_run` always store output while the Bash wrapper sometimes
   passes it through?
2. Why does the hook rewrite input before execution instead of replacing a
   completed tool result?
3. Why can automatic interception work while the MCP server is offline?
4. When is it correct to return an exact handle, and when must MiniSandbox
   avoid inventing one?
5. Why are raw output rows authoritative while FTS chunks are rebuildable?
6. Why does automatic Bash output currently need exact-handle retrieval across
   the hook/MCP session boundary?

For real-host evidence and the automated matrix behind these claims, see
[Day 9 Real Codex Acceptance](day9-real-codex-acceptance.md). For the approved
post-MVP session bridge, see
[Cross-Session Query Design](superpowers/specs/2026-10-27-cross-session-query-design.md).
