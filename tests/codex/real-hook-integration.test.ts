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

import { Client } from "@modelcontextprotocol/client";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/client/stdio";
import { beforeAll, describe, expect, it } from "vitest";

import { openProjectDatabase } from "../../src/storage/project-database.js";
import { SqliteOutputStore } from "../../src/storage/sqlite-output-store.js";

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

  it("stores through the hook and retrieves through the MCP server", async () => {
    const sandboxDirectory = mkdtempSync(
      join(tmpdir(), "mini-sandbox-real-hook-"),
    );
    const configDirectory = join(sandboxDirectory, ".mini-sandbox");
    const dataDirectory = join(sandboxDirectory, "data");
    const sessionId = "day9-large-output";
    const rawOutput = `HEAD-${"x".repeat(40)}-NEEDLE_DAY9-${"y".repeat(40)}-TAIL`;
    mkdirSync(configDirectory);
    writeFileSync(
      join(configDirectory, "config.json"),
      JSON.stringify({
        thresholdBytes: 32,
        previewBytes: 16,
        queryBudgetBytes: 1_024,
      }),
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
          session_id: sessionId,
          cwd: process.cwd(),
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command: `printf '${rawOutput}'` },
        }),
      });
      expect(hook.status, hook.stderr).toBe(0);

      const decision = JSON.parse(hook.stdout) as {
        hookSpecificOutput: {
          updatedInput: { command: string };
        };
      };
      const wrapped = spawnSync(
        "/bin/sh",
        ["-c", decision.hookSpecificOutput.updatedInput.command],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            HOME: sandboxDirectory,
            MINI_SANDBOX_DATA_DIR: dataDirectory,
          },
        },
      );

      expect(wrapped.status).toBe(0);
      expect(wrapped.stderr).toBe("");
      const stored = JSON.parse(wrapped.stdout) as {
        handle: string;
        preview: string;
        truncated: boolean;
        byteCount: number;
      };
      expect(stored).toMatchObject({
        truncated: true,
        byteCount: Buffer.byteLength(rawOutput, "utf8"),
      });
      expect(stored.preview).not.toContain("NEEDLE_DAY9");

      const project = openProjectDatabase(dataDirectory, process.cwd());
      try {
        const store = new SqliteOutputStore(project.database);
        expect(store.findByHandle(stored.handle)).toMatchObject({
          sessionId,
          rawOutput,
        });
      } finally {
        project.database.close();
      }

      const client = new Client({
        name: "day9-real-hook-test-client",
        version: "0.1.0",
      });
      try {
        await client.connect(
          new StdioClientTransport({
            command: process.execPath,
            args: [join(process.cwd(), "dist/index.js")],
            env: {
              ...getDefaultEnvironment(),
              HOME: sandboxDirectory,
              MINI_SANDBOX_DATA_DIR: dataDirectory,
              MINI_SANDBOX_SESSION_ID: "different-mcp-session",
            },
            stderr: "pipe",
          }),
        );
        const queryResult = await client.callTool({
          name: "ctx_query",
          arguments: {
            query: "NEEDLE_DAY9",
            handle: stored.handle,
          },
        });

        expect(queryResult.isError).not.toBe(true);
        expect(queryResult.content).toEqual([
          {
            type: "text",
            text: expect.stringContaining("[NEEDLE_DAY9]"),
          },
        ]);
      } finally {
        await client.close();
      }
    } finally {
      rmSync(sandboxDirectory, { recursive: true, force: true });
    }
  });

  it("preserves stdout, stderr, and a non-zero exit status", () => {
    const sandboxDirectory = mkdtempSync(
      join(tmpdir(), "mini-sandbox-real-hook-"),
    );
    const configDirectory = join(sandboxDirectory, ".mini-sandbox");
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
          session_id: "day9-exit-status",
          cwd: process.cwd(),
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: {
            command: "printf stdout; printf stderr >&2; exit 7",
          },
        }),
      });
      expect(hook.status, hook.stderr).toBe(0);

      const decision = JSON.parse(hook.stdout) as {
        hookSpecificOutput: {
          updatedInput: { command: string };
        };
      };
      const wrapped = spawnSync(
        "/bin/sh",
        ["-c", decision.hookSpecificOutput.updatedInput.command],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: { ...process.env, HOME: sandboxDirectory },
        },
      );

      expect(wrapped.stdout).toBe("stdout");
      expect(wrapped.stderr).toBe("stderr");
      expect(wrapped.status).toBe(7);
    } finally {
      rmSync(sandboxDirectory, { recursive: true, force: true });
    }
  });

  it("does not recursively rewrite an existing wrapper command", () => {
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
        session_id: "day9-recursion",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command:
            "MINI_SANDBOX_WRAPPED=1 node wrapper.js --command-base64 cHJpbnRmIGhlbGxv",
        },
      }),
    });

    expect(hook.status).toBe(0);
    expect(hook.stdout).toBe("");
    expect(hook.stderr).toBe("");
  });

  it("fails without a hook decision when the event cannot be parsed", () => {
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
      input: "not valid JSON",
    });

    expect(hook.status).not.toBe(0);
    expect(hook.stdout).toBe("");
    expect(hook.stderr).not.toBe("");
  });

  it("returns the original output when database persistence fails", () => {
    const sandboxDirectory = mkdtempSync(
      join(tmpdir(), "mini-sandbox-real-hook-"),
    );
    const configDirectory = join(sandboxDirectory, ".mini-sandbox");
    const blockedDataPath = join(sandboxDirectory, "blocked-data-path");
    mkdirSync(configDirectory);
    writeFileSync(
      join(configDirectory, "config.json"),
      JSON.stringify({ thresholdBytes: 4, previewBytes: 2 }),
    );
    writeFileSync(blockedDataPath, "not a directory");

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
          session_id: "day9-database-failure",
          cwd: process.cwd(),
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command: "printf 12345" },
        }),
      });
      expect(hook.status, hook.stderr).toBe(0);

      const decision = JSON.parse(hook.stdout) as {
        hookSpecificOutput: {
          updatedInput: { command: string };
        };
      };
      const wrapped = spawnSync(
        "/bin/sh",
        ["-c", decision.hookSpecificOutput.updatedInput.command],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            HOME: sandboxDirectory,
            MINI_SANDBOX_DATA_DIR: blockedDataPath,
          },
        },
      );

      expect(wrapped.status).toBe(0);
      expect(wrapped.stdout).toBe("12345");
      expect(wrapped.stderr).toBe("");
    } finally {
      rmSync(sandboxDirectory, { recursive: true, force: true });
    }
  });

  it("preserves captured output and status when configuration loading fails", () => {
    const sandboxDirectory = mkdtempSync(
      join(tmpdir(), "mini-sandbox-real-hook-"),
    );
    const configDirectory = join(sandboxDirectory, ".mini-sandbox");
    mkdirSync(configDirectory);
    writeFileSync(join(configDirectory, "config.json"), "not valid JSON");

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
          session_id: "day9-config-failure",
          cwd: process.cwd(),
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: {
            command: "printf SUCCESS; printf ORIGINAL_ERROR >&2; exit 7",
          },
        }),
      });
      expect(hook.status, hook.stderr).toBe(0);

      const decision = JSON.parse(hook.stdout) as {
        hookSpecificOutput: {
          updatedInput: { command: string };
        };
      };
      const wrapped = spawnSync(
        "/bin/sh",
        ["-c", decision.hookSpecificOutput.updatedInput.command],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: { ...process.env, HOME: sandboxDirectory },
        },
      );

      expect(wrapped.stdout).toBe("SUCCESS");
      expect(wrapped.stderr).toBe("ORIGINAL_ERROR");
      expect(wrapped.status).toBe(7);
    } finally {
      rmSync(sandboxDirectory, { recursive: true, force: true });
    }
  });

  it("preserves the configured zsh command semantics through the real hook", () => {
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
        session_id: "day9-zsh-semantics",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: 'values=(one two); printf "%s" "${values[1]}"',
        },
      }),
    });
    expect(hook.status, hook.stderr).toBe(0);

    const decision = JSON.parse(hook.stdout) as {
      hookSpecificOutput: {
        updatedInput: { command: string };
      };
    };
    const wrapped = spawnSync(
      "/bin/sh",
      ["-c", decision.hookSpecificOutput.updatedInput.command],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, SHELL: "/bin/zsh" },
      },
    );

    expect(wrapped.stdout).toBe("one");
    expect(wrapped.stderr).toBe("");
    expect(wrapped.status).toBe(0);
  });

  it("lets the wrapper write while another connection holds a read transaction", () => {
    const sandboxDirectory = mkdtempSync(
      join(tmpdir(), "mini-sandbox-real-hook-"),
    );
    const configDirectory = join(sandboxDirectory, ".mini-sandbox");
    const dataDirectory = join(sandboxDirectory, "data");
    mkdirSync(configDirectory);
    writeFileSync(
      join(configDirectory, "config.json"),
      JSON.stringify({ thresholdBytes: 4, previewBytes: 2 }),
    );

    const longLivedProject = openProjectDatabase(
      dataDirectory,
      process.cwd(),
    );
    const longLivedStore = new SqliteOutputStore(longLivedProject.database);

    try {
      longLivedProject.database.exec("BEGIN");
      expect(longLivedStore.stats().outputCount).toBe(0);

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
          session_id: "day9-concurrent-access",
          cwd: process.cwd(),
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command: "printf CONCURRENT_NEEDLE" },
        }),
      });
      expect(hook.status, hook.stderr).toBe(0);

      const decision = JSON.parse(hook.stdout) as {
        hookSpecificOutput: {
          updatedInput: { command: string };
        };
      };
      const wrapped = spawnSync(
        "/bin/sh",
        ["-c", decision.hookSpecificOutput.updatedInput.command],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            HOME: sandboxDirectory,
            MINI_SANDBOX_DATA_DIR: dataDirectory,
          },
        },
      );
      expect(wrapped.status, wrapped.stderr).toBe(0);

      const stored = JSON.parse(wrapped.stdout) as { handle: string };
      longLivedProject.database.exec("COMMIT");

      expect(longLivedStore.findByHandle(stored.handle)).toMatchObject({
        sessionId: "day9-concurrent-access",
        rawOutput: "CONCURRENT_NEEDLE",
      });
    } finally {
      if (longLivedProject.database.inTransaction) {
        longLivedProject.database.exec("ROLLBACK");
      }
      longLivedProject.database.close();
      rmSync(sandboxDirectory, { recursive: true, force: true });
    }
  });
});
