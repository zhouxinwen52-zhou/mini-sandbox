import { utf8ByteLength } from './utf8-byte-length.js';

export interface OutputPreview {
  text: string;
  truncated: boolean;
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

function takeUtf8Suffix(text: string, budgetBytes: number): string {
  let result = '';
  let usedBytes = 0;

  for (const character of Array.from(text).reverse()) {
    const characterBytes = utf8ByteLength(character);
    if (usedBytes + characterBytes > budgetBytes) {
      break;
    }

    result = character + result;
    usedBytes += characterBytes;
  }

  return result;
}

export function createOutputPreview(output: string, budgetBytes: number): OutputPreview {
  if (utf8ByteLength(output) <= budgetBytes) {
    return { text: output, truncated: false };
  }

  const markerBytes = utf8ByteLength(TRUNCATION_MARKER);
  if (budgetBytes < markerBytes) {
    return {
      text: takeUtf8Prefix(output, budgetBytes),
      truncated: true,
    };
  }

  const contentBudget = budgetBytes - markerBytes;
  const headBudget = Math.ceil(contentBudget / 2);
  const tailBudget = Math.floor(contentBudget / 2);

  return {
    text:
      takeUtf8Prefix(output, headBudget) +
      TRUNCATION_MARKER +
      takeUtf8Suffix(output, tailBudget),
    truncated: true,
  };
}
