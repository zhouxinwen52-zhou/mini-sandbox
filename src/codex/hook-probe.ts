import { readFileSync, writeFileSync } from "node:fs";

type PostToolUseEvent = {
  session_id?: unknown;
  transcript_path?: unknown;
  cwd?: unknown;
  hook_event_name?: unknown;
  turn_id?: unknown;
  tool_name?: unknown;
  tool_use_id?: unknown;
  tool_input?: unknown;
  tool_response?: unknown;
};

const capturePath = process.env.MINI_SANDBOX_HOOK_CAPTURE;

if (capturePath === undefined) {
  throw new Error("MINI_SANDBOX_HOOK_CAPTURE is required");
}

const event = JSON.parse(readFileSync(0, "utf8")) as PostToolUseEvent;
const sanitizedEvent = {
  session_id: "<redacted>",
  transcript_path: "<redacted>",
  cwd: "<redacted>",
  hook_event_name: event.hook_event_name,
  turn_id: "<redacted>",
  tool_name: event.tool_name,
  tool_use_id: "<redacted>",
  tool_input: "<redacted>",
  tool_response: "<redacted>",
};

writeFileSync(capturePath, `${JSON.stringify(sanitizedEvent, null, 2)}\n`, "utf8");
