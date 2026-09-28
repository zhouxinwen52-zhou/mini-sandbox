export interface CapturedOutput {
  stdout: string;
  stderr: string;
  rawOutput: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}
