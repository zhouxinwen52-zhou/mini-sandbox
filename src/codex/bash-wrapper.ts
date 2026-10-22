import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

import { loadConfig } from "../config/config.js";
import { executeCommand } from "../core/execute-command.js";
import { findProjectRoot } from "../core/find-project-root.js";
import { createStoreOutput } from "../core/store-output.js";
import { openProjectDatabase } from "../storage/project-database.js";
import { SqliteOutputStore } from "../storage/sqlite-output-store.js";
import { routeCommandOutput } from "./route-command-output.js";

function readEncodedCommand(argv: string[]): string {
  const flagIndex = argv.indexOf("--command-base64");
  const encodedCommand = flagIndex === -1 ? undefined : argv[flagIndex + 1];

  if (encodedCommand === undefined || encodedCommand.length === 0) {
    throw new Error("--command-base64 is required");
  }

  return Buffer.from(encodedCommand, "base64").toString("utf8");
}

async function main(): Promise<void> {
  const command = readEncodedCommand(process.argv.slice(2));
  const result = await executeCommand(command);
  const config = loadConfig();
  const sessionId =
    process.env.MINI_SANDBOX_SESSION_ID ?? `session_${randomUUID()}`;
  const dataDirectory =
    process.env.MINI_SANDBOX_DATA_DIR ?? join(homedir(), ".mini-sandbox");
  const projectRoot = findProjectRoot(process.cwd());
  const routed = routeCommandOutput(
    result,
    {
      thresholdBytes: config.thresholdBytes,
      projectId: projectRoot,
      sessionId,
      toolInput: command,
    },
    {
      storeOutput: (input) => {
        const project = openProjectDatabase(dataDirectory, projectRoot);

        try {
          return createStoreOutput({
            store: new SqliteOutputStore(project.database),
            previewBytes: config.previewBytes,
          })({ ...input, projectId: project.projectId });
        } finally {
          project.database.close();
        }
      },
    },
  );

  process.stdout.write(routed.stdout);
  process.stderr.write(routed.stderr);

  if (result.signal !== null) {
    process.kill(process.pid, result.signal);
    return;
  }

  process.exitCode = result.exitCode ?? 1;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`mini-sandbox wrapper: ${message}\n`);
  process.exitCode = 1;
});
