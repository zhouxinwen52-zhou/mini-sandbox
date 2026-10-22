import { describe, expect, it, vi } from "vitest";

import { routeCommandOutput } from "../../src/codex/route-command-output.js";

const capturedOutput = {
  stdout: "你",
  stderr: "",
  rawOutput: "你",
  exitCode: 0,
  signal: null,
};

describe("routeCommandOutput", () => {
  it("passes output through when its UTF-8 byte size is at the threshold", () => {
    const storeOutput = vi.fn();

    const routed = routeCommandOutput(
      capturedOutput,
      { thresholdBytes: 3, projectId: "project", sessionId: "session", toolInput: "printf 你" },
      { storeOutput },
    );

    expect(routed).toEqual({ stdout: "你", stderr: "" });
    expect(storeOutput).not.toHaveBeenCalled();
  });

  it("stores output above the UTF-8 byte threshold and emits encoded metadata", () => {
    const storedOutput = {
      handle: "out_123",
      preview: "你",
      truncated: false,
      byteCount: 3,
    };
    const storeOutput = vi.fn(() => storedOutput);

    const routed = routeCommandOutput(
      capturedOutput,
      { thresholdBytes: 2, projectId: "project", sessionId: "session", toolInput: "printf 你" },
      { storeOutput },
    );

    expect(storeOutput).toHaveBeenCalledWith({
      projectId: "project",
      sessionId: "session",
      source: "codex-bash",
      toolInput: "printf 你",
      ...capturedOutput,
    });
    expect(routed).toEqual({
      stdout: `${JSON.stringify(storedOutput)}\n`,
      stderr: "",
    });
  });
});
