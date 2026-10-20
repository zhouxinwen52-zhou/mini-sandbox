import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("PostToolUse hook probe", () => {
  it("captures a sanitized event without changing the tool result", () => {
    const captureDirectory = mkdtempSync(join(tmpdir(), "mini-sandbox-hook-probe-"));
    const capturePath = join(captureDirectory, "event.json");
    const event = {
      session_id: "session-secret",
      transcript_path: "/private/conversation.jsonl",
      cwd: "/private/project",
      hook_event_name: "PostToolUse",
      turn_id: "turn-secret",
      tool_name: "Bash",
      tool_use_id: "tool-secret",
      tool_input: { command: "printf sensitive-input" },
      tool_response: "sensitive-output",
    };

    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "src/codex/hook-probe.ts"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, MINI_SANDBOX_HOOK_CAPTURE: capturePath },
        input: JSON.stringify(event),
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(JSON.parse(readFileSync(capturePath, "utf8"))).toEqual({
      session_id: "<redacted>",
      transcript_path: "<redacted>",
      cwd: "<redacted>",
      hook_event_name: "PostToolUse",
      turn_id: "<redacted>",
      tool_name: "Bash",
      tool_use_id: "<redacted>",
      tool_input: "<redacted>",
      tool_response: "<redacted>",
    });
  });

  it("emits a stop decision for the model-visible replacement probe", () => {
    const captureDirectory = mkdtempSync(join(tmpdir(), "mini-sandbox-hook-probe-"));
    const capturePath = join(captureDirectory, "event.json");

    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "src/codex/hook-probe.ts"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          MINI_SANDBOX_HOOK_CAPTURE: capturePath,
          MINI_SANDBOX_HOOK_MODE: "stop",
        },
        input: JSON.stringify({
          hook_event_name: "PostToolUse",
          tool_name: "Bash",
          tool_response: "original tool output",
        }),
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      '{"continue":false,"stopReason":"mini-sandbox hook probe replacement"}\n',
    );
  });
});
