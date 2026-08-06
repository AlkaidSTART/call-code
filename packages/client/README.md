# Call Code History Client

这是 CLI 会话历史的静态展示端，基于 TypeScript、React 和 Tailwind CSS 构建，可直接部署到 GitHub Pages。页面默认读取 `data.json`，如果不存在则回退到 `data.example.json` 预览数据；也可以用 `?data=<url>` 指定数据文件，用 `?session=<id>` 直达某个会话。

## 构建

```bash
pnpm build:client
```

产物输出到 `packages/client/dist`，GitHub Actions 会构建后上传该目录。

## 本地开发

```bash
pnpm dev:client
```

## 导出数据

在仓库根目录运行：

```bash
pnpm export:web
```

脚本会把当前 `SESSION_DB_PATH` 指向的会话数据库导出为 `packages/client/public/data.json`。也可以在 CLI 中执行 `/export` 完成同样操作。

导出文件包含会话、消息、工具调用、统计和事实数据。发布到公开 GitHub Pages 前请先检查内容是否包含不该公开的路径、命令输出或密钥。

## 本地预览

预览构建产物：

```bash
pnpm preview:client
```

## 主题

页面内置白色毛玻璃和高级黑两套主题，侧边栏顶部的分段按钮可切换，选择会保存在浏览器本地。
