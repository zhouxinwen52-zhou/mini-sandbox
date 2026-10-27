import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizePreToolUseEvent } from "./normalize-pre-tool-use-event.js";
import { rewriteBashToolInput } from "./rewrite-bash-tool-input.js";

function quoteShellWord(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

const event = normalizePreToolUseEvent(
  JSON.parse(readFileSync(0, "utf8")) as unknown,
);

if (event !== null) {
  const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const wrapperPath = join(projectRoot, "dist/codex/bash-wrapper.js");
  const updatedInput = rewriteBashToolInput(
    event,
    `node ${quoteShellWord(wrapperPath)}`,
  );

  if (updatedInput !== null) {
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          updatedInput,
        },
      })}\n`,
    );
  }
}
