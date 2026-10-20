# Day 7 Codex hook contract probe

## Environment

- Codex CLI: `0.163.0-alpha.10.2`
- Date: 2026-10-20
- Hook source: project-local `.codex/hooks.json`
- Probe session: ephemeral, read-only sandbox

## Project trust finding

Codex loads project-local hooks only when the repository's `.codex/` layer is trusted.
Passing `--ignore-user-config` hid the existing project trust record, so the first three
probe sessions skipped the project hook. Removing that flag allowed Codex to read the
existing trust record without changing global configuration.

## PostToolUse input

The real sanitized event is stored at
`tests/fixtures/codex/post-tool-use-bash.json`. The installed Codex version reported
the canonical `tool_name` as `Bash`, even though the CLI rendered the call as `exec`.

## `continue: false` result

The probe returned:

```json
{"continue":false,"stopReason":"mini-sandbox hook probe replacement"}
```

Codex rendered `hook: PostToolUse Stopped`, proving that the hook ran and its stop
decision was accepted. However, the next model response repeated the original Bash
output marker rather than the `stopReason`.

For this installed version and ordinary CLI tool-call path, `continue: false` does not
provide the model-visible output replacement required by the current MiniSandbox
architecture. Day 8 must not implement replacement on that assumption without a
different verified contract.

## Code Mode result

The first Code Mode attempt fell back to a direct command because the CLI's
`code_mode` feature was disabled. A second ephemeral session enabled both
`code_mode` and `code_mode_only`, forcing the command through the experimental Code
Mode path. The hook capture timestamp updated during that run, proving that the
nested Bash call triggered `PostToolUse`.

The model still repeated the original Bash output marker instead of the probe's
`stopReason`. Therefore, in Codex CLI `0.163.0-alpha.10.2`, `continue: false` does not
provide MiniSandbox's required model-visible replacement in either the ordinary tool
path or the forced Code Mode path.

## `PreToolUse.updatedInput` result

A project-local `PreToolUse` probe returned `permissionDecision: "allow"` with an
`updatedInput` that replaced only the Bash `command` field. Codex reported the hook as
completed, executed the rewritten command, and showed the rewritten marker to the
model. The original marker did not appear in the command result or final model answer.

The sanitized real input is stored at
`tests/fixtures/codex/pre-tool-use-bash.json`.

This establishes a viable automatic boundary for Day 8: rewrite a native Bash request
before execution so a MiniSandbox wrapper becomes the producer of the model-visible
result. The wrapper can then execute the original command, measure actual output bytes,
and either pass through a small result or persist a large result and print a bounded
preview. Day 7 proves only the Codex rewrite contract; it does not implement that
wrapper or its routing policy.

## `PreToolUse` failure result

The probe's explicit failure mode captured the event, emitted no hook decision, and
exited with status `1`. In a real ephemeral Codex session, Codex rendered
`hook: PreToolUse Failed`, then executed the original Bash command unchanged. The
model-visible tool result and final answer both contained the original marker.

Therefore, this Codex version treats a failed `PreToolUse` command hook as fail-open.
The Day 8 wrapper must not rely on hook failure to block execution: the rewrite hook
must stay small and deterministic, and any condition that must prevent the original
command from running needs an explicit deny decision rather than a process failure.
After this probe, the project-local hook configuration was restored to normal rewrite
mode.
