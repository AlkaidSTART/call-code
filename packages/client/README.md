# Call Code History Client

这是 CLI 会话历史的静态展示端，可直接部署到 GitHub Pages。页面读取同目录下的 `data.json`，如果不存在则回退到 `data.example.json` 预览数据。

## 导出数据

在仓库根目录运行：

```bash
pnpm export:web
```

脚本会把当前 `SESSION_DB_PATH` 指向的会话数据库导出为 `packages/client/data.json`。也可以在 CLI 中执行 `/export` 完成同样操作。

导出文件包含会话、消息、工具调用、统计和事实数据。发布到公开 GitHub Pages 前请先检查内容是否包含不该公开的路径、命令输出或密钥。

## 本地预览

```bash
python3 -m http.server 4173 --directory packages/client
```

然后打开 [http://localhost:4173](http://localhost:4173)。

## 主题

页面内置白色毛玻璃和高级黑两套主题，右上角按钮可切换，选择会保存在浏览器本地。
