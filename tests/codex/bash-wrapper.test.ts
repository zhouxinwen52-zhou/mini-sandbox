import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Bash wrapper", () => {
  it("executes the decoded command and preserves stdout, stderr, and exit code", () => {
    const command = "printf stdout; printf stderr >&2; exit 7";
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "src/codex/bash-wrapper.ts",
        "--command-base64",
        Buffer.from(command, "utf8").toString("base64"),
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.stdout).toBe("stdout");
    expect(result.stderr).toBe("stderr");
    expect(result.status).toBe(7);
  });

  it("stores oversized output and returns bounded metadata", () => {
    const homeDirectory = mkdtempSync(join(tmpdir(), "mini-sandbox-wrapper-"));
    const configDirectory = join(homeDirectory, ".mini-sandbox");
    mkdirSync(configDirectory);
    writeFileSync(
      join(configDirectory, "config.json"),
      JSON.stringify({ thresholdBytes: 4, previewBytes: 2 }),
    );

    try {
      const command = "printf 12345";
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "src/codex/bash-wrapper.ts",
          "--command-base64",
          Buffer.from(command, "utf8").toString("base64"),
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            HOME: homeDirectory,
            MINI_SANDBOX_DATA_DIR: join(homeDirectory, "data"),
            MINI_SANDBOX_SESSION_ID: "wrapper-test",
          },
        },
      );

      const storedOutput = JSON.parse(result.stdout) as {
        handle: string;
        preview: string;
        truncated: boolean;
        byteCount: number;
      };

      expect(storedOutput.handle).toMatch(/^out_/);
      expect(storedOutput).toMatchObject({
        preview: "12",
        truncated: true,
        byteCount: 5,
      });
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
    } finally {
      rmSync(homeDirectory, { recursive: true, force: true });
    }
  });
});
