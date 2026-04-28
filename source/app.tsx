import React, { useState, useCallback, useMemo } from 'react';
import { render, Text, Box, useInput } from 'ink';
import { agent } from '@core/agent';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { get_encoding } from 'tiktoken';

const encoding = get_encoding('cl100k_base');

interface Message {
  type: 'user' | 'agent' | 'trace';
  content: string;
  isComplete?: boolean;
}

interface State {
  view: 'home' | 'chat';
  mode: 'plan' | 'build';
  status: 'idle' | 'loading' | 'success' | 'error';
  currentInput: string;
  messages: Message[];
  error?: string;
  currentTrace: string;
}

const App = () => {
  const [state, setState] = useState<State>({
    view: 'home',
    mode: 'build',
    status: 'idle',
    currentInput: '',
    messages: [],
    currentTrace: '',
  });

  useInput((input, key) => {
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

    const newUserMsg: Message = { type: 'user', content: text };

    setState((prev) => ({
      ...prev,
      view: 'chat',
      status: 'loading',
      currentInput: '',
      messages: [...prev.messages, newUserMsg],
      currentTrace: '思考中...',
      error: undefined,
    }));

    let currentResponse = '';

    try {
      await agent(text, {
        onStart: () => {
          setState((prev) => ({
            ...prev,
            currentTrace: '唤起模型...',
          }));
        },
        onDelta: (delta) => {
          currentResponse += delta;
          setState((prev) => {
            // 找到最后一个 agent 消息并更新，或者新加一个
            const lastMsg = prev.messages[prev.messages.length - 1];
            if (lastMsg && lastMsg.type === 'agent' && !lastMsg.isComplete) {
              const newMsgs = [...prev.messages];
              newMsgs[newMsgs.length - 1] = {
                ...lastMsg,
                content: currentResponse,
              };
              return { ...prev, messages: newMsgs };
            } else {
              return {
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    type: 'agent',
                    content: currentResponse,
                    isComplete: false,
                  },
                ],
              };
            }
          });
        },
        onComplete: (content) => {
          setState((prev) => {
            const newMsgs = prev.messages.map((m, i) =>
              i === prev.messages.length - 1 && m.type === 'agent'
                ? { ...m, content, isComplete: true }
                : m,
            );
            return {
              ...prev,
              messages: newMsgs,
              currentTrace: '',
            };
          });
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
      });

      setState((prev) => ({
        ...prev,
        status: 'success',
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, []);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      {state.view === 'home' ? (
        <Box
          flexDirection="column"
          height={10}
          justifyContent="center"
          alignItems="center"
          marginBottom={1}
        >
          <Box marginBottom={1}>
            <Text bold>
              <Text bold color="#00E6FF">
                C A L L
              </Text>
              <Text bold color="#CCCCCC">
                {' '}
                C O D E{' '}
              </Text>
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
              <Text color={state.mode === 'plan' ? '#00E6FF' : '#FF0055'}>
                {state.mode.toUpperCase()}
              </Text>
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

      {/* Input Area */}
      <Box borderStyle="single" borderColor="#333333" paddingX={1}>
        <Text color="#00E6FF">λ </Text>
        <TextInput
          value={state.currentInput}
          onChange={(val) => setState((p) => ({ ...p, currentInput: val }))}
          onSubmit={handleSubmit}
          placeholder={
            state.view === 'home' ? 'What should we build today?' : 'Reply...'
          }
        />
      </Box>

      {/* Footer controls - Moved outside for a cleaner input box */}
      <Box justifyContent="space-between" paddingX={1} marginTop={0}>
        <Text dimColor size="small">
          <Text bold color="#FFFFFF">
            TAB
          </Text>{' '}
          Mode •{' '}
          <Text bold color="#FFFFFF">
            ESC
          </Text>{' '}
          Home •{' '}
          <Text bold color="#FFFFFF">
            ^C
          </Text>{' '}
          Exit
        </Text>

        <Box>
          <Box marginRight={2}>
            <Text dimColor>Tokens: </Text>
            <Text color="#8A8A8A">{totalTokens}</Text>
          </Box>
          <Text bold color={state.mode === 'plan' ? '#00E6FF' : '#FF0055'}>
            {state.mode.toUpperCase()}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

// 渲染
render(<App />);

export default App;
