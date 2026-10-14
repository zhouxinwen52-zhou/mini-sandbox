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

function applySnippetBudget(
  snippet: string,
  budgetBytes: number,
): QueryOutputResult {
  if (utf8ByteLength(snippet) <= budgetBytes) {
    return { text: snippet, truncated: false };
  }

  const highlightStart = snippet.indexOf('[');
  const highlightEnd = snippet.indexOf(']', highlightStart + 1);
  const markerBytes = utf8ByteLength(TRUNCATION_MARKER);

  if (highlightStart > 0 && highlightEnd > highlightStart) {
    const highlighted = snippet.slice(highlightStart, highlightEnd + 1);
    if (markerBytes + utf8ByteLength(highlighted) <= budgetBytes) {
      return {
        text:
          TRUNCATION_MARKER +
          takeUtf8Prefix(snippet.slice(highlightStart), budgetBytes - markerBytes),
        truncated: true,
      };
    }
  }

  return applyQueryBudget(snippet, budgetBytes);
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
    let text = '';

    for (const match of matches) {
      const separator = text === '' ? '' : '\n\n';
      const header = [
        `handle: ${match.handle}`,
        `chunk: ${match.chunkIndex}`,
        'snippet:',
        '',
      ].join('\n');
      const textWithHeader = text + separator + header;
      const remainingBytes =
        dependencies.queryBudgetBytes - utf8ByteLength(textWithHeader);

      if (remainingBytes < 0) {
        return applyQueryBudget(
          textWithHeader,
          dependencies.queryBudgetBytes,
        );
      }

      const snippet = applySnippetBudget(match.snippet, remainingBytes);
      text = textWithHeader + snippet.text;

      if (snippet.truncated) {
        return { text, truncated: true };
      }
    }

    return { text, truncated: false };
  };
}
