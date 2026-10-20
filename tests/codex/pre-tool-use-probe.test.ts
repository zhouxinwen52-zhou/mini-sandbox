import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("PreToolUse hook probe", () => {
  it("replaces the Bash command while preserving the remaining tool input", () => {
    const captureDirectory = mkdtempSync(join(tmpdir(), "mini-sandbox-pre-tool-probe-"));
    const capturePath = join(captureDirectory, "event.json");

    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "src/codex/pre-tool-use-probe.ts"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, MINI_SANDBOX_HOOK_CAPTURE: capturePath },
        input: JSON.stringify({
          session_id: "session-secret",
          transcript_path: "/private/conversation.jsonl",
          cwd: "/private/project",
          hook_event_name: "PreToolUse",
          turn_id: "turn-secret",
          tool_name: "Bash",
          tool_use_id: "tool-secret",
          tool_input: {
            command: "printf 'MINISANDBOX_PRETOOL_ORIGINAL_DAY7'",
            timeout_ms: 1_000,
          },
        }),
      },
    );

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        updatedInput: {
          command: "printf 'MINISANDBOX_PRETOOL_REWRITTEN_DAY7'",
          timeout_ms: 1_000,
        },
      },
    });
    expect(JSON.parse(readFileSync(capturePath, "utf8"))).toEqual({
      session_id: "<redacted>",
      transcript_path: "<redacted>",
      cwd: "<redacted>",
      hook_event_name: "PreToolUse",
      turn_id: "<redacted>",
      tool_name: "Bash",
      tool_use_id: "<redacted>",
      tool_input: "<redacted>",
    });
  });

  it("exits unsuccessfully without a hook decision in failure mode", () => {
    const captureDirectory = mkdtempSync(join(tmpdir(), "mini-sandbox-pre-tool-probe-"));
    const capturePath = join(captureDirectory, "event.json");

    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "src/codex/pre-tool-use-probe.ts"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          MINI_SANDBOX_HOOK_CAPTURE: capturePath,
          MINI_SANDBOX_HOOK_MODE: "fail",
        },
        input: JSON.stringify({
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command: "printf original" },
        }),
      },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(readFileSync(capturePath, "utf8"))).toMatchObject({
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: "<redacted>",
    });
  });
});
