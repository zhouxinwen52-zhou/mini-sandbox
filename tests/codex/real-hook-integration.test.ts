import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

type HookConfig = {
  hooks: {
    PreToolUse: Array<{
      hooks: Array<{ command: string }>;
    }>;
  };
};

describe("real project-local Codex hook", () => {
  beforeAll(() => {
    const build = spawnSync("npm", ["run", "build"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(build.status, build.stderr || build.stdout).toBe(0);
  });

  it("passes small command output through unchanged", () => {
    const sandboxDirectory = mkdtempSync(
      join(tmpdir(), "mini-sandbox-real-hook-"),
    );
    const configDirectory = join(sandboxDirectory, ".mini-sandbox");
    const dataDirectory = join(sandboxDirectory, "data");
    mkdirSync(configDirectory);
    writeFileSync(
      join(configDirectory, "config.json"),
      JSON.stringify({ thresholdBytes: 1_024, previewBytes: 128 }),
    );

    try {
      const config = JSON.parse(
        readFileSync(".codex/hooks.json", "utf8"),
      ) as HookConfig;
      const hookCommand = config.hooks.PreToolUse[0]?.hooks[0]?.command;
      if (hookCommand === undefined) {
        throw new Error("project PreToolUse hook command is missing");
      }

      const hook = spawnSync("/bin/sh", ["-c", hookCommand], {
        cwd: process.cwd(),
        encoding: "utf8",
        input: JSON.stringify({
          cwd: process.cwd(),
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command: "printf DAY9_SMALL_OUTPUT" },
        }),
      });
      expect(hook.status, hook.stderr).toBe(0);

      const decision = JSON.parse(hook.stdout) as {
        hookSpecificOutput: {
          updatedInput: { command: string };
        };
      };
      const wrappedCommand =
        decision.hookSpecificOutput.updatedInput.command;
      const wrapped = spawnSync("/bin/sh", ["-c", wrappedCommand], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: sandboxDirectory,
          MINI_SANDBOX_DATA_DIR: dataDirectory,
          MINI_SANDBOX_SESSION_ID: "day9-small-output",
        },
      });

      expect(wrapped.status).toBe(0);
      expect(wrapped.stdout).toBe("DAY9_SMALL_OUTPUT");
      expect(wrapped.stderr).toBe("");
      expect(existsSync(dataDirectory)).toBe(false);
    } finally {
      rmSync(sandboxDirectory, { recursive: true, force: true });
    }
  });
});
