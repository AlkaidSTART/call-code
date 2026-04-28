import React, { useState, useEffect } from 'react';
import { render, Text, Box } from 'ink';
import { agent } from '@core/agent';
// 主组件
const App = () => {
  const [input, setInput] = useState('');

  useEffect(() => {
    void agent(input);
  }, [input]);

  return <Box flexDirection="column"></Box>;
};

// 渲染
render(<App />);

export default App;
