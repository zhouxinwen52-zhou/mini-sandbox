import { utf8ByteLength } from './utf8-byte-length.js';

export interface QueryOutputInput {
  query: string;
  handle?: string;
  limit?: number;
}

export interface QueryOutputSearchInput extends QueryOutputInput {
  projectId: string;
  sessionId: string;
}

export interface QueryOutputMatch {
  handle: string;
  chunkIndex: number;
  snippet: string;
  score: number;
}

export interface QueryOutputResult {
  text: string;
  truncated: boolean;
}

export interface QueryOutputDependencies {
  projectId: string;
  sessionId: string;
  queryBudgetBytes: number;
  search: (input: QueryOutputSearchInput) => QueryOutputMatch[];
}

const TRUNCATION_MARKER = '…';

function takeUtf8Prefix(text: string, budgetBytes: number): string {
  let result = '';
  let usedBytes = 0;

  for (const character of text) {
    const characterBytes = utf8ByteLength(character);
    if (usedBytes + characterBytes > budgetBytes) {
      break;
    }

    result += character;
    usedBytes += characterBytes;
  }

  return result;
}

function applyQueryBudget(text: string, budgetBytes: number): QueryOutputResult {
  if (utf8ByteLength(text) <= budgetBytes) {
    return { text, truncated: false };
  }

  const markerBytes = utf8ByteLength(TRUNCATION_MARKER);
  if (budgetBytes < markerBytes) {
    return {
      text: takeUtf8Prefix(text, Math.max(0, budgetBytes)),
      truncated: true,
    };
  }

  return {
    text:
      takeUtf8Prefix(text, budgetBytes - markerBytes) + TRUNCATION_MARKER,
    truncated: true,
  };
}

export function createQueryOutput(
  dependencies: QueryOutputDependencies,
): (input: QueryOutputInput) => QueryOutputResult {
  return (input) => {
    const matches = dependencies.search({
      projectId: dependencies.projectId,
      sessionId: dependencies.sessionId,
      ...input,
    });
    const text = matches
      .map((match) =>
        [
          `handle: ${match.handle}`,
          `chunk: ${match.chunkIndex}`,
          'snippet:',
          match.snippet,
        ].join('\n'),
      )
      .join('\n\n');

    return applyQueryBudget(text, dependencies.queryBudgetBytes);
  };
}
