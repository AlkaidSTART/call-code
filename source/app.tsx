import React, { useState, useCallback, useMemo } from 'react';
import { render, Text, Box, useInput } from 'ink';
import { agent } from '@core/agent';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { get_encoding } from 'tiktoken';

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

interface State {
  view: 'home' | 'chat';
  mode: 'plan' | 'build';
  phase: 'idle' | 'planning' | 'awaiting_confirm' | 'building';
  status: 'idle' | 'loading' | 'success' | 'error';
  currentInput: string;
  messages: Message[];
  error?: string;
  currentTrace: string;
  planDraft: string;
  confirmSelection: 0 | 1;
}

const App = () => {
  const [state, setState] = useState<State>({
    view: 'home',
    mode: 'build',
    phase: 'idle',
    status: 'idle',
    currentInput: '',
    messages: [],
    currentTrace: '',
    planDraft: '',
    confirmSelection: 0,
  });

  useInput((input, key) => {
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

  const handleSubmit = useCallback(async (text: string) => {
    if (!text.trim()) {
      return;
    }

    const trimmed = text.trim();
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
        ...prev,
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
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, [state.mode, state.phase, state.planDraft]);

  const isHome = state.view === 'home';
  const inputPlaceholder = isHome
    ? 'Ask Call Code to build...'
    : state.phase === 'awaiting_confirm'
      ? '输入更多信息，继续完善计划...'
      : 'Reply...';
  const inputBorderColor = isHome ? colors.border : colors.panel;
  const modeColor = state.mode === 'plan' ? colors.clay : colors.ink;

  const controls = (
    <Box justifyContent="space-between" paddingX={1} marginTop={isHome ? 0 : 0}>
      <Text dimColor>
        <Text color={colors.ink}>tab</Text> mode ·{' '}
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
          />
        </Box>
      </Box>
    </Box>
  );
};

// 渲染
render(<App />);

export default App;
