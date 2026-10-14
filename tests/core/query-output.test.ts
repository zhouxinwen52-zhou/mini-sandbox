import { describe, expect, test, vi } from 'vitest';

import { createQueryOutput } from '../../src/core/query-output.js';
import { utf8ByteLength } from '../../src/core/utf8-byte-length.js';

describe('QueryOutput', () => {
  test('queries the current project and session and renders ranked snippets', () => {
    const search = vi.fn(() => [
      {
        handle: 'out_first',
        chunkIndex: 2,
        snippet: 'alpha [needle] omega',
        score: -3,
      },
      {
        handle: 'out_second',
        chunkIndex: 0,
        snippet: 'another [needle]',
        score: -1,
      },
    ]);
    const queryOutput = createQueryOutput({
      projectId: 'project-abc',
      sessionId: 'session-current',
      queryBudgetBytes: 4 * 1024,
      search,
    });

    const result = queryOutput({
      query: 'needle',
      handle: 'out_first',
      limit: 2,
    });

    expect(search).toHaveBeenCalledWith({
      projectId: 'project-abc',
      sessionId: 'session-current',
      query: 'needle',
      handle: 'out_first',
      limit: 2,
    });
    expect(result).toEqual({
      text: [
        'handle: out_first',
        'chunk: 2',
        'snippet:',
        'alpha [needle] omega',
        '',
        'handle: out_second',
        'chunk: 0',
        'snippet:',
        'another [needle]',
      ].join('\n'),
      truncated: false,
    });
  });

  test('bounds the total response by UTF-8 bytes and keeps top-ranked content first', () => {
    const queryOutput = createQueryOutput({
      projectId: 'project-abc',
      sessionId: 'session-current',
      queryBudgetBytes: 55,
      search: () => [
        {
          handle: 'out_first',
          chunkIndex: 0,
          snippet: '中'.repeat(20),
          score: -3,
        },
        {
          handle: 'out_second',
          chunkIndex: 0,
          snippet: 'lower-ranked',
          score: -1,
        },
      ],
    });

    const result = queryOutput({ query: '中' });

    expect(result.truncated).toBe(true);
    expect(utf8ByteLength(result.text)).toBeLessThanOrEqual(55);
    expect(result.text).toMatch(/^handle: out_first/);
    expect(result.text).not.toContain('out_second');
    expect(result.text).not.toContain('�');
  });
});
