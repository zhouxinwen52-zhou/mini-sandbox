# MiniSandbox

MiniSandbox keeps oversized local command output out of a model's working
context while preserving the complete result for later retrieval. It is a
learning-focused TypeScript project with two working paths:

- `ctx_run` explicitly executes a command, stores its complete output, and
  returns a bounded preview plus a stable handle.
- A project-local Codex `PreToolUse` hook rewrites native Bash calls through a
  command wrapper. Small output passes through unchanged; oversized output is
  stored and replaced with a handle and bounded preview.

`ctx_query` searches stored output with SQLite FTS5 and BM25-ranked snippets.

MiniSandbox is a **context/output sandbox**, not an operating-system security
sandbox. Commands run with the permissions of the user who starts Codex or the
MCP server. It does not promise to remove raw output from the Codex UI, logs,
or transcripts.

## Requirements

- Node.js 22 or newer
- npm
- Git
- A Codex version that supports project-local configuration and synchronous
  `PreToolUse` hooks

Check the local tools before installing:

```sh
node --version
npm --version
git --version
```

## Install and verify

Clone the repository, install the locked dependencies, and build the runtime
used by both Codex and the MCP server:

```sh
git clone https://github.com/zhouxinwen52-zhou/mini-sandbox.git
cd mini-sandbox
npm ci
npm run typecheck
npm run build
npm test
```

A successful setup finishes with no TypeScript errors and a green test suite.
The checked-in project configuration is already wired to the build output:

- `.codex/hooks.json` runs `dist/codex/pre-tool-use.js` before native Bash
  calls and lets it replace the command with the MiniSandbox wrapper.
- `.codex/config.toml` registers `dist/index.js` as the `mini_sandbox` MCP
  server and grants the wrapper access to `~/.mini-sandbox`.

Open this repository as a Codex project after the build. Approve its local
project configuration if your Codex host asks, then start a fresh Codex chat so
the hook and MCP server are loaded from the beginning of the session.

## Smoke check

In the fresh Codex chat, ask Codex to run a small Bash command:

```sh
printf 'mini-sandbox-small-output\n'
```

The text should pass through unchanged. Then ask it to run a command whose
output exceeds the default 10 KiB threshold. The result sent to the model
should be bounded JSON containing a handle, preview, truncation flag, and the
original UTF-8 byte count. Use that exact handle with `ctx_query` to retrieve a
term that was outside the preview.

You can inspect the current project's local store from a terminal:

```sh
node dist/cli.js stats
```

The Day 9 acceptance record contains the real-host evidence and the full
failure-path matrix: [Day 9 real Codex acceptance](docs/day9-real-codex-acceptance.md).

## Configuration

MiniSandbox reads optional global configuration from
`~/.mini-sandbox/config.json`. Missing values use the defaults shown here:

```json
{
  "thresholdBytes": 10240,
  "previewBytes": 2048,
  "queryBudgetBytes": 4096
}
```

- `thresholdBytes` controls when automatically wrapped output is stored.
- `previewBytes` bounds stored-output previews and must be smaller than the
  threshold.
- `queryBudgetBytes` bounds the complete text returned by one query.

All values are positive integer byte counts. Invalid fields or unknown fields
produce a field-specific configuration error. Automatic wrapper failures are
fail-open: after the original command runs, its captured stdout and stderr are
returned instead of an invented handle.

## Maintenance commands

Run maintenance commands from the project whose database you want to manage:

```sh
node dist/cli.js stats
node dist/cli.js reindex
node dist/cli.js purge
```

`reindex` rebuilds the derived FTS index from authoritative raw records.
`purge` permanently removes every stored output for the detected project, so
inspect `stats` first.

## Disable or remove

To disable MiniSandbox for this repository without deleting data, stop using
the project-local `.codex/hooks.json` and remove the `[mcp_servers.mini_sandbox]`
entry from `.codex/config.toml`, then start a fresh Codex chat. In this learning
repository those files are tracked, so make such edits only on a disposable
copy or your own integration branch.

Stored data and optional global configuration live under `~/.mini-sandbox`.
For a recoverable removal, first move that directory aside:

```sh
mv ~/.mini-sandbox ~/.mini-sandbox.backup
```

After confirming that nothing needs to be restored, delete the backup using
your normal file-management workflow. Removing the repository itself does not
remove this global data directory.

## Architecture and learning goals

The entrypoints are separate protocol boundaries: the MCP server, Codex hook,
command wrapper, and maintenance CLI all depend on a host-neutral application
core. Raw SQLite output records are authoritative; FTS chunks are derived and
rebuildable.

The project is designed to teach:

- MCP server lifecycle and tool registration;
- Codex hook timing and model-visible command rewriting;
- adapter and application-core boundaries;
- SQLite transactions, WAL, FTS5, and BM25 retrieval;
- UTF-8 byte budgets, previews, and chunking;
- session scoping and observable fail-open behavior.

See the [architecture design](docs/superpowers/specs/2026-09-16-mini-sandbox-design.md),
the [ten-day implementation plan](docs/superpowers/plans/2026-09-16-mini-sandbox-implementation.md),
and the post-MVP [cross-session query design](docs/superpowers/specs/2026-10-27-cross-session-query-design.md).

MiniSandbox is inspired by the architecture and engineering ideas behind
[context-mode](https://github.com/mksglu/context-mode), but it is an independent,
smaller design rather than a source-code copy.
