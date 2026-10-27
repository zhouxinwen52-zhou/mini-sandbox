import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("PreToolUse production hook", () => {
  it("rewrites an eligible Bash request to the MiniSandbox wrapper", () => {
    const originalCommand = "printf 'hello from Day 9' | wc -c";
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "src/codex/pre-tool-use.ts"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        input: JSON.stringify({
          cwd: process.cwd(),
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: {
            command: originalCommand,
            timeout_ms: 1_000,
          },
        }),
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const decision = JSON.parse(result.stdout) as {
      hookSpecificOutput: {
        hookEventName: string;
        permissionDecision: string;
        updatedInput: Record<string, unknown>;
      };
    };
    const updatedCommand = decision.hookSpecificOutput.updatedInput.command;

    expect(decision).toMatchObject({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        updatedInput: { timeout_ms: 1_000 },
      },
    });
    expect(updatedCommand).toEqual(expect.any(String));
    expect(updatedCommand).toContain("MINI_SANDBOX_WRAPPED=1");
    expect(updatedCommand).toContain("dist/codex/bash-wrapper.js");

    const encodedCommand = (updatedCommand as string).split(
      " --command-base64 ",
    )[1];
    if (encodedCommand === undefined) {
      throw new Error("rewritten command is missing --command-base64");
    }
    expect(Buffer.from(encodedCommand, "base64").toString("utf8")).toBe(
      originalCommand,
    );
  });
});
