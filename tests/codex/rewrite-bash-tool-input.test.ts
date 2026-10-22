import { describe, expect, it } from "vitest";

import { rewriteBashToolInput } from "../../src/codex/rewrite-bash-tool-input.js";

describe("rewriteBashToolInput", () => {
  it("wraps a Bash command while preserving the remaining tool input", () => {
    expect(
      rewriteBashToolInput(
        {
          cwd: "/workspace/project",
          toolName: "Bash",
          toolInput: {
            command: "printf 'hello world' | wc -c",
            timeout_ms: 1_000,
          },
        },
        "node /workspace/dist/codex/bash-wrapper.js",
      ),
    ).toEqual({
      command:
        "MINI_SANDBOX_WRAPPED=1 node /workspace/dist/codex/bash-wrapper.js --command-base64 cHJpbnRmICdoZWxsbyB3b3JsZCcgfCB3YyAtYw==",
      timeout_ms: 1_000,
    });
  });

  it.each([
    {
      cwd: "/workspace/project",
      toolName: "Read",
      toolInput: { command: "printf hello" },
    },
    {
      cwd: "/workspace/project",
      toolName: "Bash",
      toolInput: {},
    },
    {
      cwd: "/workspace/project",
      toolName: "Bash",
      toolInput: {
        command:
          "MINI_SANDBOX_WRAPPED=1 node wrapper.js --command-base64 cHJpbnRmIGhlbGxv",
      },
    },
  ])("does not rewrite an ineligible request: %j", (event) => {
    expect(
      rewriteBashToolInput(
        event,
        "node /workspace/dist/codex/bash-wrapper.js",
      ),
    ).toBeNull();
  });
});
