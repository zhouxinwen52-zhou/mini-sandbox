import { executeCommand } from "../core/execute-command.js";

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

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);

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
