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
