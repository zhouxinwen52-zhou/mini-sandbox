import { describe, expect, it } from "vitest";

import { normalizePreToolUseEvent } from "../../src/codex/normalize-pre-tool-use-event.js";

describe("normalizePreToolUseEvent", () => {
  it("keeps only the fields needed to decide whether a Bash request can be rewritten", () => {
    expect(
      normalizePreToolUseEvent({
        session_id: "session-secret",
        transcript_path: "/private/conversation.jsonl",
        cwd: "/workspace/project",
        hook_event_name: "PreToolUse",
        turn_id: "turn-secret",
        tool_name: "Bash",
        tool_use_id: "tool-secret",
        tool_input: {
          command: "printf hello",
          timeout_ms: 1_000,
        },
      }),
    ).toEqual({
      cwd: "/workspace/project",
      sessionId: "session-secret",
      toolName: "Bash",
      toolInput: {
        command: "printf hello",
        timeout_ms: 1_000,
      },
    });
  });

  it.each([
    null,
    {},
    { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {} },
    { hook_event_name: "PreToolUse", tool_name: 42, tool_input: {} },
    { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: null },
  ])("rejects malformed or non-PreToolUse input: %j", (input) => {
    expect(normalizePreToolUseEvent(input)).toBeNull();
  });
});
