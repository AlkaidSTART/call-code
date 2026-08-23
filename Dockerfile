# 使用 Node 24 提供 node:sqlite 和 npm，Bun 负责按 bun.lock 安装依赖
FROM node:24-bookworm-slim

# coding agent 会在挂载的工作区执行命令，补齐常用工具
RUN apt-get update \
  && apt-get install -y --no-install-recommends bash git ripgrep ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 与 packageManager 保持一致，避免 bun.lock 被其他版本改写
RUN npm install -g bun@1.3.11

WORKDIR /app

# 先复制清单文件，依赖层可以复用 Docker 缓存
COPY package.json bun.lock bunfig.toml tsconfig.json ./
COPY packages/agent-core/package.json packages/agent-core/
COPY packages/client/package.json packages/client/
COPY packages/server/package.json packages/server/
COPY packages/session-sqlite/package.json packages/session-sqlite/

RUN bun install --frozen-lockfile

COPY source source
COPY packages/agent-core packages/agent-core
COPY packages/server packages/server
COPY packages/session-sqlite packages/session-sqlite

# 默认把挂载的用户目录作为工作区，会话和工具执行都落在里面
WORKDIR /workspace

# 入口用 tsx 加载 TypeScript，tsconfig 固定指向 /app，避免受工作区影响
CMD ["node", "/app/node_modules/tsx/dist/cli.mjs", "--tsconfig", "/app/tsconfig.json", "/app/source/app.tsx"]
