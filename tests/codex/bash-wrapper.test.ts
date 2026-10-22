import { spawnSync } from "node:child_process";

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
});
