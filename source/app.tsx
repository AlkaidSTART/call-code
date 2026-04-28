import React, { useState, useCallback } from 'react';
import { render, Text, Box } from 'ink';
import { agent } from '@core/agent';
import TextInput from 'ink-text-input';

interface State {
  status: 'idle' | 'loading' | 'success' | 'error';
  input: string;
  output: string;
  error?: string;
  trace: string[];
}

const App = () => {
  const [state, setState] = useState<State>({
    status: 'idle',
    input: '',
    output: '',
    trace: [],
  });

  const handleSubmit = useCallback(async (text: string) => {
    if (!text.trim()) {
      return;
    }

    setState((prev) => ({
      ...prev,
      status: 'loading',
      input: text,
      output: '',
      error: undefined,
      trace: ['开始处理输入...', '正在准备流式输出...'],
    }));

    try {
      const result = await agent(text, {
        onStart: () => {
          setState((prev) => ({
            ...prev,
            trace: [...prev.trace, '模型已开始返回内容'],
          }));
        },
        onDelta: (delta) => {
          setState((prev) => ({
            ...prev,
            output: `${prev.output}${delta}`,
          }));
        },
        onComplete: (content) => {
          setState((prev) => ({
            ...prev,
            trace: [...prev.trace, '流式输出完成'],
            output: content,
          }));
        },
        onError: (error) => {
          setState((prev) => ({
            ...prev,
            trace: [...prev.trace, '模型调用失败'],
            error: error instanceof Error ? error.message : String(error),
          }));
        },
        onTrace: (message) => {
          setState((prev) => ({
            ...prev,
            trace: [...prev.trace, message],
          }));
        },
      });
      setState((prev) => ({
        ...prev,
        status: 'success',
        output: result,
        trace: [...prev.trace, '执行成功'],
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        trace: [...prev.trace, '执行失败'],
      }));
    }
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🤖 Coding Agent CLI
        </Text>
      </Box>

      {/* Input Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>输入指令:</Text>
        <TextInput
          value={state.input}
          onChange={(value) =>
            setState((prev) => ({
              ...prev,
              input: value,
            }))
          }
          onSubmit={handleSubmit}
          placeholder="输入你的指令后按 Enter"
        />
      </Box>

      {/* Status Indicator */}
      {state.status === 'loading' && (
        <Box marginBottom={1}>
          <Text color="yellow">⏳ 处理中...</Text>
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>思考 / 过程:</Text>
        {state.trace.length === 0 ? (
          <Text dimColor>等待输入...</Text>
        ) : (
          state.trace.map((item, index) => (
            <Text key={`${item}-${index}`} color="blue">
              • {item}
            </Text>
          ))
        )}
      </Box>

      {state.status === 'success' && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="green">
            ✅ 执行成功
          </Text>
          <Box borderStyle="round" borderColor="green" paddingX={1}>
            <Text>{state.output}</Text>
          </Box>
        </Box>
      )}

      {state.status === 'error' && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="red">
            ❌ 执行失败
          </Text>
          <Text color="red">{state.error}</Text>
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>按 Ctrl+C 退出</Text>
      </Box>
    </Box>
  );
};

// 渲染
render(<App />);

export default App;
