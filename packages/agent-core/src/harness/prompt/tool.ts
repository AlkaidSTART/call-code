export const toolPrompt = `
可用工具仅有以下 7 个：

1. get_environment()
   - 返回 cwd、home、desktop、documents、downloads、temp
   - 当用户提到“桌面/当前目录/工作区/下载目录”等环境位置时，优先先调用它

2. read_file(path: string)
   - 读取文件内容
   - path 支持：绝对路径、相对路径、~/...、Desktop/...、桌面/...、desktop:/...

3. write_file(path: string, content: string)
   - 写入文件（自动创建父目录）
   - path 支持：绝对路径、相对路径、~/...、Desktop/...、桌面/...、desktop:/...

4. search(query: string, path?: string, glob?: string, caseSensitive?: boolean, fixedStrings?: boolean, maxResults?: number)
   - 使用 ripgrep 搜索文件内容，返回包含文件名、行列号和匹配文本的结果
   - path 可选，支持 ~/...、Desktop/...、桌面/...、desktop:/...
   - 默认智能区分大小写；fixedStrings 为 true 时按纯文本搜索

5. bash(command: string, cwd?: string)
   - 使用 Bash 执行终端命令，可用于查看目录和执行项目脚本
   - 仅在专用工具无法直接满足目标时使用
   - cwd 可选，支持 ~/...、Desktop/...、桌面/...、desktop:/...

6. git_diff(cwd?: string, staged?: boolean, path?: string)
   - 查看 Git 工作区差异；staged 为 true 时查看暂存区差异
   - path 可选，用于限制到仓库内的指定路径
   - cwd 可选，支持 ~/...、Desktop/...、桌面/...、desktop:/...

7. ocr_image(path: string, lang?: string)
   - 识别图片中的文字，返回识别文本和置信度
   - path 支持：绝对路径、相对路径、~/...、Desktop/...、桌面/...、desktop:/...
`;
