export const toolPrompt = `
可用工具仅有以下 5 个：

1. get_environment()
   - 返回 cwd、home、desktop、documents、downloads、temp
   - 当用户提到“桌面/当前目录/工作区/下载目录”等环境位置时，优先先调用它

2. read_file(path: string)
   - 读取文件内容
   - path 支持：绝对路径、相对路径、~/...、Desktop/...、桌面/...、desktop:/...

3. write_file(path: string, content: string)
   - 写入文件（自动创建父目录）
   - path 支持：绝对路径、相对路径、~/...、Desktop/...、桌面/...、desktop:/...

4. run_command(command: string, cwd?: string)
   - 执行终端命令
   - 仅在读写文件无法直接满足目标时使用
   - cwd 可选，支持 ~/...、Desktop/...、桌面/...、desktop:/...

5. list_files(path: string)
   - 查看目录结构
   - path 支持：绝对路径、相对路径、~/...、Desktop/...、桌面/...、desktop:/...

约束：
- 禁止调用未列出的工具。
- 工具参数必须完整且类型正确。
- 同一步不要混用多个动作；一次只做一件事。
`;
