export const toolPrompt = `
你可以使用以下工具：

1. get_environment()
   - 感知当前运行环境，返回 cwd、home、desktop、documents、downloads、temp 等常用路径
   - 当用户提到“桌面”“当前目录”“工作区”“下载目录”等环境相关位置时，优先调用它

2. read_file(path: string)
   - 读取文件内容
   - path 支持绝对路径、相对路径、~/...、Desktop/...、桌面/...、desktop:/...

3. write_file(path: string, content: string)
   - 写入文件
   - 会自动创建父目录
   - path 支持绝对路径、相对路径、~/...、Desktop/...、桌面/...、desktop:/...

4. run_command(command: string, cwd?: string)
   - 执行终端命令
   - cwd 可选，支持 ~/...、Desktop/...、桌面/...、desktop:/...

5. list_files(path: string)
   - 查看目录结构
   - path 支持绝对路径、相对路径、~/...、Desktop/...、桌面/...、desktop:/...
`;
