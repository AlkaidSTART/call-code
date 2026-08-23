# Call Code History Client

这是 CLI 会话历史的 Web 展示端，基于 TypeScript、React 和 Tailwind CSS 构建。页面通过 WebSocket 从会话服务实时读取数据，不再依赖静态 JSON 文件。

## 构建

```bash
bun run build:client
```

产物输出到 `packages/client/dist`。

## 本地开发

先启动会话服务，再启动 Vite 开发服务器：

```bash
bun run web:serve
bun run dev:client
```

`web:serve` 默认监听 `127.0.0.1:4173`，可通过 `CALL_CODE_WEB_PORT` 修改端口；Vite 会把 `/ws` 代理到会话服务。

## 数据服务

CLI 会话写入 `SESSION_DB_PATH` 指向的 SQLite 数据库，默认 `.agent-sessions/sessions.db`。`web:serve` 读取同一个数据库，并在 `/ws` 提供 `sessions.list` / `sessions.snapshot` 消息。页面默认连接同源 `/ws`，也可以使用 `?ws=<url>` 覆盖服务地址，使用 `?session=<id>` 直达某个会话。

## 主题

页面内置白色毛玻璃和高级黑两套主题，侧边栏顶部的分段按钮可切换，选择会保存在浏览器本地。
