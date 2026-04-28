import React, { useState, useEffect } from 'react';
import { render, Text, Box } from 'ink';

// 主组件
const App = () => {
  const [count, setCount] = useState(0);

  // 每秒+1
  useEffect(() => {
    const t = setInterval(() => setCount((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <Box flexDirection="column" padding={1} borderStyle="round">
      <Text bold color="cyan">
        🚀 我的第一个 Ink CLI
      </Text>
      <Box marginTop={1}>
        <Text>计数器：</Text>
        <Text color="green" bold>
          {count}
        </Text>
      </Box>
    </Box>
  );
};

// 渲染
render(<App />);

export default App;
