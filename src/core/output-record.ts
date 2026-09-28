export interface OutputRecord {
  handle: string;
  projectId: string;
  sessionId: string;
  source: string;
  toolInput: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  byteCount: number;
  createdAt: string;
}

export interface OutputStore {
  save(record: OutputRecord): void;
  findByHandle(handle: string): OutputRecord | undefined;
}
