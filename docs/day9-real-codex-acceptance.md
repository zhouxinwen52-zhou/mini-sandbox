# Day 9 Real Codex Acceptance

## Outcome

Day 9 connects the project-local Codex `PreToolUse` hook to the production command wrapper and registers the project MCP server. A fresh Codex host session proved the success path end to end; automated integration tests cover the failure and concurrency branches that would require deliberately breaking the live host configuration.

## Real-host evidence

The acceptance run started a fresh, ephemeral Codex CLI session from the repository with strict project-config parsing and no command-line writable-root override. Hook trust was bypassed only for this non-interactive, pre-vetted acceptance run.

The host reported this effective sandbox:

```text
workspace-write [workdir, /tmp, $TMPDIR, /Users/zhou/.mini-sandbox]
```

The following checks ran through the host's actual Bash tool and registered `mini_sandbox` MCP server:

| Check | Evidence | Result |
| --- | --- | --- |
| Project hook loading | Codex emitted `hook: PreToolUse Completed` and executed `dist/codex/bash-wrapper.js` | Pass |
| Small-output passthrough | `printf DAY9_CONFIG_PARSE_OK` returned the original text | Pass |
| Large-output replacement | A 12,034-byte result returned handle `out_f67c06ed-8bb2-440a-95f2-e9d055a5fd8d` plus a bounded preview | Pass |
| Project MCP registration | Codex invoked `mini_sandbox.ctx_query` without manually starting an MCP client | Pass |
| Later retrieval | Exact-handle query found `DAY9_FINAL_REAL_HOST_NEEDLE_6B8E` in chunk 2 | Pass |

The acceptance session ID was `01a17b37-19c2-7342-a580-93a3d2aa9305`. Its event stream showed the original Bash command rewritten to the wrapper before execution and the subsequent MCP tool call using the returned handle.

## Session boundary

The hook and MCP server have independent lifecycles. The hook receives the live Codex session ID and stores it with automatically captured output. The long-lived MCP process has its own session ID, so an unscoped `ctx_query` remains scoped to explicit MCP work such as `ctx_run`. Automatic output retrieval uses the exact handle printed by the wrapper; the storage contract intentionally allows an exact handle to address another session in the same project.

This avoids a shared mutable "current session" file, which could route concurrent Codex chats to the wrong session.

## Automated acceptance matrix

`tests/codex/real-hook-integration.test.ts` exercises the production hook command and wrapper process for the remaining branches:

- small-output passthrough and large-output persistence;
- exact-handle retrieval through a real stdio MCP client with an independent MCP session;
- recursion prevention;
- original exit-status and signal preservation;
- hook failure and MCP-server independence;
- database and configuration failure passthrough;
- zsh command semantics; and
- concurrent SQLite read/write access.

The final Day 9 verification passed type checking, build, and all 96 tests across 23 test files.
