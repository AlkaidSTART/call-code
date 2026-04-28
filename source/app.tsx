import React, { useState, useCallback } from 'react';
import { render, Text, Box } from 'ink';
import { agent } from '@core/agent';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import Divider from 'ink-divider';

interface Message {
  type: 'user' | 'agent' | 'trace';
  content: string;
  isComplete?: boolean;
}

interface State {
  status: 'idle' | 'loading' | 'success' | 'error';
  currentInput: string;
  messages: Message[];
  error?: string;
  currentTrace: string;
}

const App = () => {
  const [state, setState] = useState<State>({
    status: 'idle',
    currentInput: '',
    messages: [],
    currentTrace: '',
  });

  const handleSubmit = useCallback(async (text: string) => {
    if (!text.trim()) {
      return;
    }

    const newUserMsg: Message = { type: 'user', content: text };

    setState((prev) => ({
      ...prev,
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
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* branding: call-code Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color="#D1D1D1">
          CALL-CODE <Text dimColor>v1.0.0</Text>
        </Text>
      </Box>

      {/* Message History */}
      <Box flexDirection="column" marginBottom={1}>
        {state.messages.map((msg, index) => (
          <Box key={index} flexDirection="column" marginTop={1}>
            {msg.type === 'user' ? (
              <Box>
                <Text color="#8A8A8A" bold>
                  ＞{' '}
                </Text>
                <Text bold color="#FFFFFF">
                  {msg.content}
                </Text>
              </Box>
            ) : (
              <Box flexDirection="column" marginLeft={2}>
                <Box marginBottom={1}>
                  <Divider
                    title="RESPONSE"
                    titleColor="#D7D7D7"
                    dividerColor="#333333"
                  />
                </Box>
                <Text color="#D7D7D7">{msg.content}</Text>
                {!msg.isComplete && <Text color="#D7D7D7">...</Text>}
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {/* Thinking / Trace Section (Floating/Status style) */}
      {state.status === 'loading' && (
        <Box marginLeft={2} marginBottom={1}>
          <Text color="#6B6B6B">
            <Spinner type="dots" />{' '}
            <Text italic>{state.currentTrace || '思考中...'}</Text>
          </Text>
        </Box>
      )}

      {/* Error Message */}
      {state.status === 'error' && (
        <Box borderStyle="round" borderColor="red" paddingX={1} marginY={1}>
          <Text color="red">Error: {state.error}</Text>
        </Box>
      )}

      {/* Fixed Bottom Input Area */}
      <Box
        marginTop={1}
        borderStyle="single"
        borderColor="#333333"
        paddingX={1}
      >
        <Text color="#D7D7D7"></Text>
        <TextInput
          value={state.currentInput}
          onChange={(val) => setState((p) => ({ ...p, currentInput: val }))}
          onSubmit={handleSubmit}
          placeholder="Ask call-code a question..."
        />
      </Box>

      <Box marginTop={1}>
        <Text dimColor size="small">
          Press Ctrl+C to exit
        </Text>
      </Box>
    </Box>
  );
};

// 渲染
render(<App />);

export default App;
