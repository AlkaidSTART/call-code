# call-code

![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)
![MIT License](https://img.shields.io/badge/License-MIT-4B32C3)

call-code 是一个本地运行的终端编程 Agent（CLI coding agent），基于 Node.js、TypeScript 和 Ink 构建。它可以在用户当前工作目录中接受自然语言任务，通过工具调用读取文件、写入文件、执行命令、查看环境信息，并结合本地短/长期记忆持续完成任务。

## 功能特性

- 终端交互界面：基于 Ink 的命令行界面，支持首页、对话、历史选择和相关页面预览。
- 双执行模式：`PLAN` 模式只允许生成计划和读取环境，`BUILD` 模式可以写入文件、执行命令并推进任务。
- 本地工具集：内置 `get_environment`、`read_file`、`write_file`、`list_files`、`run_command` 五个工具。
- 结构化响应协议：模型输出统一为 `tool_call` 或 `final` 的 JSON action，循环解析并继续执行。
- 本地记忆：短期记忆按任务保存，长期记忆按主题沉淀，仅在进程内使用，不写入本地 JSON。
- 上下文预算：运行时基于 token 估算对历史消息做裁剪，减少超出模型上下文的风险。

## 架构

```text
source/app.tsx                         CLI 层
   首页 / 对话 / 历史 / 相关页面预览
        │  用户输入、命令与活动面板操作
        ▼
agent-core                             核心层
├─ core/       agent 与 runLoop 主循环：规划 -> 执行 -> 观察
├─ context/    构建上下文、历史摘要与 token 预算
├─ protocol/   解析 tool_call / final JSON action
├─ policy/     PLAN / BUILD 模式下的工具权限
├─ tools/      get_environment / read_file / write_file
│              list_files / run_command
├─ memory/     short / long 记忆（仅存内存，不落盘 JSON）
└─ prompt/     系统提示词、工具说明与模式提示词
        │  OpenAI chat.completions 请求（支持流式）
        ▼
OpenAI-compatible LLM                  模型层
        ▲
        │  返回 tool_call 或 final action
        └── 循环执行，直到任务完成
```

运行时的核心流程：

1. CLI 接收自然语言任务，交给 agent 构建上下文并调用 LLM。
2. 模型返回 `tool_call` 或 `final`，由 protocol 解析为结构化 action。
3. policy 按 `PLAN` / `BUILD` 模式校验权限，允许后由对应工具执行。
4. 工具执行结果作为 observation 回写，memory 记录关键信息，循环继续，直到返回 `final`。

## 项目结构

```text
source/
  app.tsx                    # Ink CLI 入口与交互界面
packages/
  agent-core/                # 核心 agent、上下文、记忆、工具与协议实现
    src/
      core/                  # agent、runLoop、state、LLM 调用
      context/               # 上下文构建、历史摘要与 token 管理
      memory/                # 短期/长期记忆存储与检索
      protocol/              # 模型 action/observation 协议解析
      prompt/                # 系统提示词、工具说明、模式提示词
      tools/                 # 环境、文件、命令等本地工具
      policy/                # PLAN/BUILD 模式下的工具权限
      web/                   # GitHub Pages 客户端数据导出
  client/                    # 静态会话历史界面，可部署到 GitHub Pages
tests/                        # 项目统一单元测试
 vitest.config.ts             # Vitest 测试配置
```

## 快速开始

1. 安装依赖（建议 Node.js 20+，并使用 pnpm）。
2. 将 `.env.example` 复制为 `.env`，配置 `OPENAI_API_KEY`。
3. 启动 CLI，入口为 `source/app.tsx`。

```bash
cp .env.example .env
pnpm install
pnpm dev
```

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `OPENAI_API_KEY` | 必填，OpenAI 兼容 API 的 Key。 |
| `OPENAI_API_BASE_URL` | 可选，自定义 OpenAI 兼容 base URL。 |
| `OPENAI_MODEL` | 必填，模型名称，无默认值；未配置时 CLI 会提示。 |
| `AGENT_DESKTOP_DIR` | 可选，覆盖桌面目录路径，便于测试或自定义工作环境。 |

## 常用命令

以下命令与当前 CI 保持一致：

```bash
# 启动 CLI
pnpm dev

# 类型检查
pnpm exec tsc -p tsconfig.json --noEmit

# 运行测试
pnpm exec vitest run --reporter verbose

# 构建 agent-core
pnpm run build:agent-core

# 导出会话历史到 packages/client/data.json
pnpm export:web
```

## 测试说明

测试文件统一放在项目根目录的 `tests/` 目录下，根目录的 `vitest.config.ts` 会统一收集并运行。

## License

MIT License，详见 [LICENSE](LICENSE)。
