import { utf8ByteLength } from './utf8-byte-length.js';

const SEPARATORS = ['\n', ' '] as const;

function splitAfterSeparator(text: string, separator: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let separatorIndex = text.indexOf(separator, start);

  while (separatorIndex !== -1) {
    const end = separatorIndex + separator.length;
    parts.push(text.slice(start, end));
    start = end;
    separatorIndex = text.indexOf(separator, start);
  }

  if (start < text.length) {
    parts.push(text.slice(start));
  }

  return parts;
}

function mergeWithinBudget(parts: string[], maxBytes: number): string[] {
  const chunks: string[] = [];
  let current = '';

  for (const part of parts) {
    if (current !== '' && utf8ByteLength(current + part) > maxBytes) {
      chunks.push(current);
      current = '';
    }

    current += part;
  }

  if (current !== '') {
    chunks.push(current);
  }

  return chunks;
}

function splitByCharacters(text: string, maxBytes: number): string[] {
  const characters = Array.from(text);

  if (characters.some((character) => utf8ByteLength(character) > maxBytes)) {
    throw new RangeError('maxBytes must fit at least one UTF-8 character');
  }

  return mergeWithinBudget(characters, maxBytes);
}

function trailingCompleteLines(chunk: string, lineCount: number): string[] {
  if (lineCount === 0) {
    return [];
  }

  const completeText = chunk.slice(0, chunk.lastIndexOf('\n') + 1);
  if (completeText === '') {
    return [];
  }

  return completeText.split('\n').slice(0, -1).slice(-lineCount);
}

function addLineOverlap(
  chunks: string[],
  maxBytes: number,
  overlapLines: number,
): string[] {
  return chunks.map((chunk, index) => {
    if (index === 0) {
      return chunk;
    }

    const previous = chunks[index - 1];
    if (previous === undefined) {
      return chunk;
    }

    const overlap = trailingCompleteLines(previous, overlapLines);
    while (overlap.length > 0) {
      const prefix = `${overlap.join('\n')}\n`;
      if (utf8ByteLength(prefix + chunk) <= maxBytes) {
        return prefix + chunk;
      }

      overlap.shift();
    }

    return chunk;
  });
}

function splitRecursively(
  text: string,
  maxBytes: number,
  separatorIndex: number,
): string[] {
  if (utf8ByteLength(text) <= maxBytes) {
    return [text];
  }

  const separator = SEPARATORS[separatorIndex];
  if (separator === undefined) {
    return splitByCharacters(text, maxBytes);
  }

  const parts = splitAfterSeparator(text, separator).flatMap((part) =>
    utf8ByteLength(part) <= maxBytes
      ? [part]
      : splitRecursively(part, maxBytes, separatorIndex + 1),
  );

  return mergeWithinBudget(parts, maxBytes);
}

export function splitText(
  text: string,
  maxBytes: number,
  overlapLines = 0,
): string[] {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError('maxBytes must be a positive integer');
  }

  if (text === '') {
    return [];
  }

  const chunks = splitRecursively(text, maxBytes, 0);
  return addLineOverlap(chunks, maxBytes, overlapLines);
}
