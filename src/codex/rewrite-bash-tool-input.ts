import type { NormalizedPreToolUseEvent } from "./normalize-pre-tool-use-event.js";

const WRAPPED_COMMAND_PREFIX = "MINI_SANDBOX_WRAPPED=1 ";

export function rewriteBashToolInput(
  event: NormalizedPreToolUseEvent,
  wrapperCommand: string,
): Record<string, unknown> | null {
  const command = event.toolInput.command;

  if (
    event.toolName !== "Bash" ||
    typeof command !== "string" ||
    command.length === 0 ||
    command.trimStart().startsWith(WRAPPED_COMMAND_PREFIX)
  ) {
    return null;
  }

  const encodedCommand = Buffer.from(command, "utf8").toString("base64");

  return {
    ...event.toolInput,
    command: `${WRAPPED_COMMAND_PREFIX}${wrapperCommand} --command-base64 ${encodedCommand}`,
  };
}
