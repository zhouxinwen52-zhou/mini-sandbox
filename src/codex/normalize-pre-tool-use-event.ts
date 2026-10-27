export type NormalizedPreToolUseEvent = {
  cwd?: string;
  sessionId?: string;
  toolName: string;
  toolInput: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizePreToolUseEvent(
  value: unknown,
): NormalizedPreToolUseEvent | null {
  if (
    !isRecord(value) ||
    value.hook_event_name !== "PreToolUse" ||
    typeof value.tool_name !== "string" ||
    !isRecord(value.tool_input) ||
    (value.cwd !== undefined && typeof value.cwd !== "string") ||
    (value.session_id !== undefined && typeof value.session_id !== "string")
  ) {
    return null;
  }

  return {
    ...(value.cwd === undefined ? {} : { cwd: value.cwd }),
    ...(value.session_id === undefined ? {} : { sessionId: value.session_id }),
    toolName: value.tool_name,
    toolInput: value.tool_input,
  };
}
