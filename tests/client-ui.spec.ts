import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeaderBar } from '../packages/client/src/components/HeaderBar';
import type { WebSession } from '../packages/client/src/types';

vi.mock('../packages/client/assets/call-code.png', () => ({
  default: 'call-code.png',
}));

const makeSession = (overrides: Partial<WebSession> = {}): WebSession => ({
  id: 's1',
  createdAt: '2026-08-05T00:00:00.000Z',
  cwd: '/tmp/project',
  parentSessionId: null,
  metadata: {},
  stats: {
    messageCount: 2,
    cachedTokens: 0,
    uncachedTokens: 0,
    totalTokens: 0,
    costTotal: 0,
  },
  entries: [
    {
      seq: 1,
      id: 'e1',
      parentId: null,
      type: 'user',
      role: 'user',
      timestamp: '2026-08-05T00:00:00.000Z',
      payload: {},
    },
    {
      seq: 2,
      id: 'e2',
      parentId: null,
      type: 'tool',
      role: 'tool',
      timestamp: '2026-08-05T00:00:00.000Z',
      tool: 'read_file',
      payload: {},
    },
  ],
  records: [],
  facts: [],
  ...overrides,
});

describe('client HeaderBar', () => {
  it('顶部栏展示产品名、会话统计和主题切换', () => {
    const html = renderToStaticMarkup(
      React.createElement(HeaderBar, {
        sessions: [makeSession()],
        theme: 'dark',
        onThemeChange: () => undefined,
      }),
    );

    expect(html).toContain('Call Code');
    expect(html).toContain('1 个会话');
    expect(html).toContain('2 条消息');
    expect(html).toContain('1 次工具');
    expect(html).toContain('高级黑');
  });

  it('统计按多个会话累加', () => {
    const second = makeSession({ id: 's2' });
    const html = renderToStaticMarkup(
      React.createElement(HeaderBar, {
        sessions: [makeSession(), second],
        theme: 'light',
        onThemeChange: () => undefined,
      }),
    );

    expect(html).toContain('2 个会话');
    expect(html).toContain('4 条消息');
    expect(html).toContain('2 次工具');
    expect(html).toContain('毛玻璃');
  });
});
