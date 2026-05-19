import React, { useState, useCallback, useMemo } from 'react';
import fs from 'node:fs';
import { render, Text, Box, useInput } from 'ink';
import { agent } from '@core/agent';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { get_encoding } from 'tiktoken';
import { memoryStore } from '@agent-core/memory/memory-store';
import type { ShortMemoryItem } from '@agent-core/memory/memory-schema';
import { resolveUserPath } from '@tools/pathUtils';

const encoding = get_encoding('cl100k_base');

const brandLines = [
  '  ______ ___    __    __       ______ ____  ____  ______',
  ' / ____//   |  / /   / /      / ____// __ \\/ __ \\/ ____/',
  '/ /    / /| | / /   / /      / /    / / / / / / / __/   ',
  '/ /___ / ___ |/ /___/ /___   / /___ / /_/ / /_/ / /___   ',
  '\\____//_/  |_/_____/_____/   \\____/ \\____/_____/_____/   ',
];

const colors = {
  ink: '#E8E4DD',
  muted: '#8E8780',
  faint: '#5E5852',
  clay: '#C9A27E',
  clayDim: '#A98263',
  border: '#6F6258',
  panel: '#333333',
};

interface Message {
  type: 'user' | 'agent' | 'trace';
  content: string;
  isComplete?: boolean;
}

interface RelatedPage {
  path: string;
  label: string;
}

type ActivityItem =
  | {
      type: 'history';
      id: string;
      label: string;
      content: string;
      role: ShortMemoryItem['role'];
    }
  | {
      type: 'page';
      id: string;
      label: string;
      path: string;
    };

interface State {
  view: 'home' | 'chat';
  mode: 'plan' | 'build';
  phase: 'idle' | 'planning' | 'awaiting_confirm' | 'building';
  status: 'idle' | 'loading' | 'success' | 'error';
  currentInput: string;
  messages: Message[];
  recentHistory: ShortMemoryItem[];
  relatedPages: RelatedPage[];
  activityFocus: boolean;
  activitySelection: number;
  error?: string;
  currentTrace: string;
  planDraft: string;
  confirmSelection: 0 | 1;
}

const compactText = (text: string, maxLength = 96): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}...`;
};

const extractRelatedPages = (items: ShortMemoryItem[]): RelatedPage[] => {
  const pages = new Map<string, RelatedPage>();

  for (const item of items) {
    const matches = item.content.matchAll(
      /"(?:requestedPath|path)"\s*:\s*"([^"]+)"/g,
    );

    for (const match of matches) {
      const pagePath = match[1];
      if (!pagePath || pages.has(pagePath)) {
        continue;
      }

      pages.set(pagePath, {
        path: pagePath,
        label:
          pagePath.split('/').filter(Boolean).slice(-1)[0] ?? pagePath,
      });
    }
  }

  return [...pages.values()].slice(-6).reverse();
};

const loadActivityPanel = () => {
  const shortItems = memoryStore.listShort();

  return {
    recentHistory: shortItems
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .slice(-8)
      .reverse(),
    relatedPages: extractRelatedPages(shortItems),
  };
};

const clampActivitySelection = (
  selection: number,
  activity: ReturnType<typeof loadActivityPanel>,
): number => {
  const itemCount = activity.recentHistory.length + activity.relatedPages.length;
  return Math.min(selection, Math.max(itemCount - 1, 0));
};

const firstPageSelection = (
  activity: ReturnType<typeof loadActivityPanel>,
): number => {
  const pageIndex = activity.recentHistory.length;
  return activity.relatedPages.length > 0 ? pageIndex : 0;
};

const loadPagePreview = (pagePath: string): string => {
  try {
    const resolvedPath = resolveUserPath(pagePath);
    const stat = fs.statSync(resolvedPath);

    if (stat.isDirectory()) {
      const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
      const content = entries
        .slice(0, 30)
        .map((entry) => `${entry.isDirectory() ? '[dir]' : '[file]'} ${entry.name}`)
        .join('\n');

      return `相关页面: ${pagePath}\n路径: ${resolvedPath}\n\n${content || '目录为空'}`;
    }

    const content = fs.readFileSync(resolvedPath, 'utf8');
    return `相关页面: ${pagePath}\n路径: ${resolvedPath}\n\n${compactText(content, 1600)}`;
  } catch (error) {
    return `无法加载相关页面: ${pagePath}\n${
      error instanceof Error ? error.message : String(error)
    }`;
  }
};

const commandHelp = [
  '可用命令:',
  '/help - 查看命令与快捷键',
  '/history - 打开最近对话和相关页面选择',
  '/pages - 打开相关页面选择',
  '/memory - 查看 memory 概览',
  '/status - 查看当前 CLI 状态',
  '/mode - 查看当前模式和阶段',
  '/plan - 切换到 PLAN 模式',
  '/build - 切换到 BUILD 模式',
  '/clear - 清空当前聊天窗口',
  '/home - 返回首页，保留当前会话',
  '/exit - 结束当前会话并返回首页',
  '',
  '快捷键:',
  'Tab 切换模式',
  'Ctrl+H 打开历史选择',
  'Esc 返回首页或退出选择',
  'Ctrl+C 退出程序',
].join('\n');

const readOnlyCommands = new Set(['/help', '/status']);

const App = () => {
  const initialActivity = loadActivityPanel();
  const [state, setState] = useState<State>({
    view: 'home',
    mode: 'build',
    phase: 'idle',
    status: 'idle',
    currentInput: '',
    messages: [],
    recentHistory: initialActivity.recentHistory,
    relatedPages: initialActivity.relatedPages,
    activityFocus: false,
    activitySelection: 0,
    currentTrace: '',
    planDraft: '',
    confirmSelection: 0,
  });

  const activityItems = useMemo<ActivityItem[]>(
    () => [
      ...state.recentHistory.map((item) => ({
        type: 'history' as const,
        id: item.id,
        label: `${item.role === 'user' ? 'U' : 'A'} ${compactText(item.content, 42)}`,
        content: item.content,
        role: item.role,
      })),
      ...state.relatedPages.map((page) => ({
        type: 'page' as const,
        id: page.path,
        label: page.label,
        path: page.path,
      })),
    ],
    [state.recentHistory, state.relatedPages],
  );

  useInput((input, key) => {
    if (key.ctrl && input === 'h' && state.view === 'chat') {
      setState((prev) => ({
        ...prev,
        activityFocus: !prev.activityFocus,
        activitySelection: Math.min(
          prev.activitySelection,
          Math.max(activityItems.length - 1, 0),
        ),
      }));
      return;
    }

    if (state.activityFocus) {
      if (key.escape) {
        setState((prev) => ({ ...prev, activityFocus: false }));
        return;
      }

      if (key.upArrow) {
        setState((prev) => ({
          ...prev,
          activitySelection: Math.max(prev.activitySelection - 1, 0),
        }));
        return;
      }

      if (key.downArrow) {
        setState((prev) => ({
          ...prev,
          activitySelection: Math.min(
            prev.activitySelection + 1,
            Math.max(activityItems.length - 1, 0),
          ),
        }));
        return;
      }

      if (key.return) {
        const selected = activityItems[state.activitySelection];
        if (!selected) {
          return;
        }

        setState((prev) => ({
          ...prev,
          activityFocus: false,
          messages: [
            ...prev.messages,
            {
              type: 'agent',
              content:
                selected.type === 'history'
                  ? `历史记录 (${selected.role})\n${selected.content}`
                  : loadPagePreview(selected.path),
              isComplete: true,
            },
          ],
        }));
        return;
      }
    }

    if (
      state.phase === 'awaiting_confirm' &&
      state.status !== 'loading' &&
      key.escape
    ) {
      setState((prev) => ({
        ...prev,
        phase: 'idle',
        planDraft: '',
        confirmSelection: 0,
      }));
      return;
    }

    if (state.phase === 'awaiting_confirm' && state.status !== 'loading') {
      if (key.upArrow || key.leftArrow) {
        setState((prev) => ({ ...prev, confirmSelection: 0 }));
        return;
      }
      if (key.downArrow || key.rightArrow) {
        setState((prev) => ({ ...prev, confirmSelection: 1 }));
        return;
      }
      if (key.return) {
        if (state.confirmSelection === 0) {
          void handleSubmit('__CONFIRM_EXECUTE__');
        }
        return;
      }
    }

    if (key.tab) {
      // Toggle mode on Tab
      setState((prev) => ({
        ...prev,
        mode: prev.mode === 'plan' ? 'build' : 'plan',
      }));
    }
    if (key.escape && state.view === 'chat') {
      // Return to home on Escape
      setState((prev) => ({
        ...prev,
        view: 'home',
      }));
    }
  });

  const totalTokens = useMemo(() => {
    const text =
      state.messages.map((m) => m.content).join('\n') + state.currentInput;
    try {
      return encoding.encode(text).length;
    } catch {
      return 0;
    }
  }, [state.messages, state.currentInput]);

  const showCommandMessage = useCallback((content: string) => {
    setState((prev) => ({
      ...prev,
      view: 'chat',
      currentInput: '',
      messages: [
        ...prev.messages,
        {
          type: 'agent',
          content,
          isComplete: true,
        },
      ],
    }));
  }, []);

  const handleCommand = useCallback((rawCommand: string): boolean => {
    const command = rawCommand.trim().toLowerCase();
    if (!command.startsWith('/')) {
      return false;
    }

    if (state.status === 'loading' && !readOnlyCommands.has(command)) {
      showCommandMessage('当前任务运行中，只能使用 /help 或 /status。');
      return true;
    }

    const refreshActivity = () => {
      const activity = loadActivityPanel();
      return {
        ...activity,
        activitySelection: clampActivitySelection(state.activitySelection, activity),
      };
    };

    switch (command) {
      case '/help':
        showCommandMessage(commandHelp);
        return true;

      case '/history': {
        const activity = loadActivityPanel();
        setState((prev) => ({
          ...prev,
          view: 'chat',
          currentInput: '',
          ...activity,
          activityFocus: true,
          activitySelection: 0,
          messages:
            activity.recentHistory.length + activity.relatedPages.length === 0
              ? [
                  ...prev.messages,
                  {
                    type: 'agent',
                    content: '暂无最近对话或相关页面。',
                    isComplete: true,
                  },
                ]
              : prev.messages,
        }));
        return true;
      }

      case '/pages': {
        const activity = loadActivityPanel();
        setState((prev) => ({
          ...prev,
          view: 'chat',
          currentInput: '',
          ...activity,
          activityFocus: activity.relatedPages.length > 0,
          activitySelection: firstPageSelection(activity),
          messages:
            activity.relatedPages.length === 0
              ? [
                  ...prev.messages,
                  {
                    type: 'agent',
                    content: '暂无相关页面。',
                    isComplete: true,
                  },
                ]
              : prev.messages,
        }));
        return true;
      }

      case '/memory': {
        const snapshot = memoryStore.snapshot();
        const lastError = memoryStore.getLastError();
        showCommandMessage(
          [
            'Memory 概览',
            `短期记忆: ${snapshot.short.length}`,
            `长期记忆: ${snapshot.long.length}`,
            `文件: ${memoryStore.getMemoryFile()}`,
            `最近错误: ${lastError ?? '无'}`,
          ].join('\n'),
        );
        return true;
      }

      case '/status':
        showCommandMessage(
          [
            '当前状态',
            `view: ${state.view}`,
            `mode: ${state.mode}`,
            `phase: ${state.phase}`,
            `status: ${state.status}`,
            `tokens: ${totalTokens}`,
            `最近历史: ${state.recentHistory.length}`,
            `相关页面: ${state.relatedPages.length}`,
          ].join('\n'),
        );
        return true;

      case '/mode':
        showCommandMessage(`当前模式: ${state.mode.toUpperCase()}\n当前阶段: ${state.phase}`);
        return true;

      case '/plan':
        setState((prev) => ({
          ...prev,
          view: 'chat',
          mode: 'plan',
          currentInput: '',
          messages: [
            ...prev.messages,
            { type: 'agent', content: '已切换到 PLAN 模式。', isComplete: true },
          ],
        }));
        return true;

      case '/build':
        setState((prev) => ({
          ...prev,
          view: 'chat',
          mode: 'build',
          currentInput: '',
          messages: [
            ...prev.messages,
            { type: 'agent', content: '已切换到 BUILD 模式。', isComplete: true },
          ],
        }));
        return true;

      case '/clear':
        setState((prev) => ({
          ...prev,
          view: 'chat',
          status: 'idle',
          currentInput: '',
          messages: [],
          error: undefined,
          currentTrace: '',
          activityFocus: false,
          phase: 'idle',
          planDraft: '',
          confirmSelection: 0,
          ...refreshActivity(),
        }));
        return true;

      case '/home':
        setState((prev) => ({
          ...prev,
          view: 'home',
          currentInput: '',
          activityFocus: false,
        }));
        return true;

      case '/exit':
        setState((prev) => ({
          ...prev,
          view: 'home',
          phase: 'idle',
          status: 'idle',
          currentInput: '',
          messages: [],
          error: undefined,
          currentTrace: '',
          planDraft: '',
          confirmSelection: 0,
          activityFocus: false,
          ...refreshActivity(),
        }));
        return true;

      default:
        showCommandMessage(`未知命令：${rawCommand.trim()}，输入 /help 查看可用命令。`);
        return true;
    }
  }, [
    showCommandMessage,
    state.activitySelection,
    state.mode,
    state.phase,
    state.recentHistory.length,
    state.relatedPages.length,
    state.status,
    state.view,
    totalTokens,
  ]);

  const handleSubmit = useCallback(async (text: string) => {
    if (!text.trim()) {
      return;
    }

    const trimmed = text.trim();
    if (handleCommand(trimmed)) {
      return;
    }

    const isConfirmTrigger = text === '__CONFIRM_EXECUTE__';
    const newUserMsg: Message = {
      type: 'user',
      content: isConfirmTrigger ? '执行计划（选择）' : text,
    };
    const isConfirm =
      state.phase === 'awaiting_confirm' && isConfirmTrigger;

    if (state.phase === 'awaiting_confirm' && !isConfirm) {
      setState((prev) => ({
        ...prev,
        view: 'chat',
        mode: 'plan',
        status: 'loading',
        currentInput: '',
        messages: [...prev.messages, newUserMsg],
        currentTrace: '继续根据你的修改意见调整计划...',
        error: undefined,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        view: 'chat',
        mode: isConfirm ? 'build' : prev.mode,
        phase: isConfirm ? 'building' : prev.phase,
        status: 'loading',
        currentInput: '',
        messages:
          prev.phase === 'awaiting_confirm'
            ? [...prev.messages, newUserMsg]
            : [newUserMsg],
        currentTrace: `思考中...（模式: ${state.mode.toUpperCase()}）`,
        error: undefined,
      }));
    }

    try {
      const runMode =
        state.phase === 'awaiting_confirm' && isConfirm ? 'build' : state.mode;
      const promptInput =
        state.phase === 'awaiting_confirm' && isConfirm
          ? `已确认执行以下计划，请直接开始实施：\n${state.planDraft}`
          : state.phase === 'awaiting_confirm' && !isConfirm
          ? `${state.planDraft}\n\n用户修改意见：${text}`
          : text;

      const finalResponse = await agent(promptInput, {
        onStart: () => {
          setState((prev) => ({
            ...prev,
            currentTrace: '唤起模型...',
          }));
        },
        onError: (error) => {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            currentTrace: '',
          }));
        },
        onTrace: (message) => {
          setState((prev) => ({
            ...prev,
            currentTrace: message,
          }));
        },
      }, { mode: runMode, workspace: process.cwd() });

      setState((prev) => ({
        ...(() => {
          const activity = loadActivityPanel();
          return {
            ...prev,
            ...activity,
            activitySelection: clampActivitySelection(prev.activitySelection, activity),
          };
        })(),
        status: 'success',
        currentTrace: '',
        phase:
          runMode === 'plan' ? 'awaiting_confirm' : 'idle',
        mode: runMode === 'plan' ? 'plan' : 'build',
        planDraft: runMode === 'plan' ? finalResponse || '请确认是否执行这个计划。' : '',
        confirmSelection: 0,
        messages:
          runMode === 'plan'
            ? [
                ...prev.messages.filter((msg) => msg.type !== 'agent'),
                {
                  type: 'agent',
                  content: `${finalResponse || '请确认是否执行这个计划。'}\n\n可直接补充新信息继续完善计划，或在下方面板选择是否执行。`,
                  isComplete: true,
                },
              ]
            : [
                ...prev.messages,
                {
                  type: 'agent',
                  content: finalResponse || '已完成',
                  isComplete: true,
                },
              ],
      }));
    } catch (error) {
      setState((prev) => ({
        ...(() => {
          const activity = loadActivityPanel();
          return {
            ...prev,
            ...activity,
            activitySelection: clampActivitySelection(prev.activitySelection, activity),
          };
        })(),
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, [state.mode, state.phase, state.planDraft]);

  const isHome = state.view === 'home';
  const modeColor = state.mode === 'plan' ? colors.clay : colors.ink;
  const isChoosing =
    state.activityFocus ||
    (state.phase === 'awaiting_confirm' && state.status !== 'loading');
  const inputFocused = !isChoosing;
  const inputPlaceholder = isHome
    ? 'Ask Call Code to build...'
    : isChoosing
      ? '正在选择，Esc 返回输入...'
      : state.phase === 'awaiting_confirm'
        ? '输入更多信息，继续完善计划...'
        : 'Reply...';
  const inputBorderColor = isChoosing
    ? colors.clay
    : isHome
      ? colors.border
      : colors.panel;

  const controls = (
    <Box justifyContent="space-between" paddingX={1} marginTop={isHome ? 0 : 0}>
      <Text dimColor>
        <Text color={colors.ink}>tab</Text> mode ·{' '}
        <Text color={colors.ink}>ctrl-h</Text> history ·{' '}
        <Text color={colors.ink}>esc</Text> home ·{' '}
        <Text color={colors.ink}>ctrl-c</Text> exit
      </Text>

      <Box>
        <Box marginRight={2}>
          <Text dimColor>tokens </Text>
          <Text color={colors.muted}>{totalTokens}</Text>
        </Box>
        <Text bold color={modeColor}>
          {state.mode.toUpperCase()}
        </Text>
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      {isHome ? (
        <Box
          flexDirection="column"
          marginTop={1}
          marginBottom={1}
          alignItems="center"
        >
          <Box flexDirection="column" marginBottom={1}>
            {brandLines.map((line, index) => (
              <Text
                key={line}
                bold
                color={index < 2 ? colors.clay : colors.ink}
              >
                {line}
              </Text>
            ))}
          </Box>

          <Box>
            <Text color={state.mode === 'plan' ? colors.clay : colors.muted}>
              plan
            </Text>
            <Text color={colors.faint}> / </Text>
            <Text color={state.mode === 'build' ? colors.clay : colors.muted}>
              build
            </Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          {/* Header in Chat View */}
          <Box
            borderStyle="round"
            borderColor="#333333"
            paddingX={1}
            marginBottom={1}
            justifyContent="space-between"
          >
            <Box>
              <Text bold color="#00E6FF">
                CALL
              </Text>
              <Text bold color="#CCCCCC">
                CODE
              </Text>
            </Box>
            <Box>
              <Text dimColor>Mode: </Text>
              <Text color={modeColor}>{state.mode.toUpperCase()}</Text>
              <Text dimColor italic>
                {' '}
                (ESC to Home)
              </Text>
            </Box>
          </Box>

          {/* Message History */}
          <Box flexDirection="column" marginBottom={0}>
            {state.messages.map((msg, index) => (
              <Box
                key={index}
                flexDirection="column"
                marginTop={0}
                marginBottom={1}
              >
                {msg.type === 'user' ? (
                  <Box>
                    <Text color="#00E6FF" bold>
                      User:
                    </Text>
                    <Text color="#FFFFFF"> {msg.content}</Text>
                  </Box>
                ) : (
                  <Box flexDirection="column">
                    <Text color="#D7D7D7">{msg.content}</Text>
                    {!msg.isComplete && <Text color="#D7D7D7">...</Text>}
                  </Box>
                )}
              </Box>
            ))}
          </Box>

          <Box
            borderStyle="round"
            borderColor={colors.border}
            paddingX={1}
            marginBottom={1}
            flexDirection="column"
          >
            <Box justifyContent="space-between">
              <Text color={state.activityFocus ? '#00E6FF' : colors.clay}>
                最近活动
              </Text>
              <Text color={colors.faint}>
                Ctrl+H 选择 · {state.recentHistory.length} 条 / {state.relatedPages.length} 页
              </Text>
            </Box>

            {activityItems.length === 0 ? (
              <Text color={colors.faint}>暂无最近对话</Text>
            ) : (
              activityItems.map((item, index) => (
                <Box key={item.id}>
                  <Text
                    color={
                      state.activityFocus && state.activitySelection === index
                        ? '#00E6FF'
                        : colors.faint
                    }
                  >
                    {state.activityFocus && state.activitySelection === index ? '>' : ' '}{' '}
                  </Text>
                  <Text color={item.type === 'history' && item.role === 'user' ? '#00E6FF' : colors.muted}>
                    {item.type === 'history' ? (item.role === 'user' ? 'U' : 'A') : 'P'}{' '}
                  </Text>
                  <Text color={colors.ink}>
                    {item.type === 'history'
                      ? compactText(item.content)
                      : `${item.label} ${compactText(item.path, 72)}`}
                  </Text>
                </Box>
              ))
            )}

            {state.activityFocus && activityItems.length > 0 && (
              <Text color={colors.faint}>
                ↑/↓ 选择 · Enter 查看 · Esc 返回输入
              </Text>
            )}
          </Box>
        </Box>
      )}

      {/* Thinking / Trace Section */}
      {state.status === 'loading' && (
        <Box marginBottom={1}>
          <Text color="#6B6B6B">
            <Spinner type="dots" />{' '}
            <Text italic>{state.currentTrace || 'Thinking...'}</Text>
          </Text>
        </Box>
      )}

      {/* Error Message */}
      {state.status === 'error' && (
        <Box
          borderStyle="round"
          borderColor="red"
          paddingX={1}
          marginBottom={1}
        >
          <Text color="red">Error: {state.error}</Text>
        </Box>
      )}

      {controls}

      {state.phase === 'awaiting_confirm' && state.status !== 'loading' && (
        <Box
          borderStyle="round"
          borderColor={colors.border}
          paddingX={1}
          marginBottom={1}
          flexDirection="column"
        >
          <Text color={colors.clay}>计划确认</Text>
          <Text color={colors.muted}>
            使用 ↑/↓ 选择，Enter 确认。输入框可继续补充信息。
          </Text>
          <Text color={state.confirmSelection === 0 ? colors.clay : colors.muted}>
            {state.confirmSelection === 0 ? '›' : ' '} 执行计划（自动切换 BUILD）
          </Text>
          <Text color={state.confirmSelection === 1 ? colors.clay : colors.muted}>
            {state.confirmSelection === 1 ? '›' : ' '} 继续完善计划（保持 PLAN）
          </Text>
        </Box>
      )}

      {/* Input Area */}
      <Box borderStyle="round" borderColor={inputBorderColor} paddingX={1}>
        <Text color={isHome ? colors.clay : colors.muted}>
          {isHome ? '>' : '›'}{' '}
        </Text>
        <Box flexGrow={1}>
          <TextInput
            value={state.currentInput}
            onChange={(val) => setState((p) => ({ ...p, currentInput: val }))}
            onSubmit={handleSubmit}
            placeholder={inputPlaceholder}
            focus={inputFocused}
          />
        </Box>
      </Box>
    </Box>
  );
};

// 渲染
render(<App />);

export default App;
