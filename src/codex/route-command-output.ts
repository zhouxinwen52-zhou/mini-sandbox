import type { CapturedOutput } from "../core/captured-output.js";
import type { StoredOutput, StoreOutputInput } from "../core/store-output.js";
import { utf8ByteLength } from "../core/utf8-byte-length.js";

interface RouteCommandOutputOptions {
  thresholdBytes: number;
  projectId: string;
  sessionId: string;
  toolInput: string;
}

interface RouteCommandOutputDependencies {
  storeOutput: (input: StoreOutputInput) => StoredOutput;
}

export interface RoutedCommandOutput {
  stdout: string;
  stderr: string;
}

export function routeCommandOutput(
  output: CapturedOutput,
  options: RouteCommandOutputOptions,
  { storeOutput }: RouteCommandOutputDependencies,
): RoutedCommandOutput {
  if (utf8ByteLength(output.rawOutput) <= options.thresholdBytes) {
    return { stdout: output.stdout, stderr: output.stderr };
  }

  let storedOutput: StoredOutput;

  try {
    storedOutput = storeOutput({
      projectId: options.projectId,
      sessionId: options.sessionId,
      source: "codex-bash",
      toolInput: options.toolInput,
      ...output,
    });
  } catch {
    return { stdout: output.stdout, stderr: output.stderr };
  }

  return {
    stdout: `${JSON.stringify(storedOutput)}\n`,
    stderr: "",
  };
}
