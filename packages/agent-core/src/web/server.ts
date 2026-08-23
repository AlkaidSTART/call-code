import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { buildWebExport, type WebStore } from './export';
import { parseClientMessage, type WebSocketServerMessage } from './protocol';

const DEFAULT_CLIENT_DIR = fileURLToPath(
  new URL('../../../client/dist', import.meta.url),
);
const DEFAULT_PORT = 4173;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export interface WebServerOptions {
  store: WebStore;
  clientDir?: string;
  host?: string;
  port?: number;
}

export interface WebServerHandle {
  host: string;
  port: number;
  close(): Promise<void>;
}

const sendJson = (socket: WebSocket, message: WebSocketServerMessage) => {
  socket.send(JSON.stringify(message));
};

const safePath = (root: string, pathname: string): string | null => {
  const candidate = resolve(root, `.${pathname}`);
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return null;
  }
  return candidate;
};

const serveFile = async (
  res: ServerResponse,
  target: string,
  headOnly: boolean,
): Promise<boolean> => {
  try {
    const info = await stat(target);
    if (!info.isFile()) {
      return false;
    }

    const content = await readFile(target);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(target)] ?? 'application/octet-stream',
      'Content-Length': content.length,
    });
    res.end(headOnly ? undefined : content);
    return true;
  } catch {
    return false;
  }
};

const serveStatic = async (
  req: IncomingMessage,
  res: ServerResponse,
  clientDir: string,
): Promise<void> => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  let pathname = '/';
  try {
    pathname = decodeURIComponent(
      new URL(req.url ?? '/', 'http://localhost').pathname,
    );
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }

  const root = resolve(clientDir);
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = safePath(root, requested);
  if (!filePath) {
    res.writeHead(404);
    res.end();
    return;
  }

  const headOnly = req.method === 'HEAD';
  if (await serveFile(res, filePath, headOnly)) {
    return;
  }

  // 单页应用回退到入口页，避免刷新子路由时 404
  const fallback = join(root, 'index.html');
  if (await serveFile(res, fallback, headOnly)) {
    return;
  }

  res.writeHead(404);
  res.end();
};

/**
 * 启动 Web 会话面板：静态托管客户端构建产物，并在 /ws 提供会话快照。
 */
export const startWebServer = async (
  options: WebServerOptions,
): Promise<WebServerHandle> => {
  const store = options.store;
  const clientDir = options.clientDir ?? DEFAULT_CLIENT_DIR;
  const host = options.host ?? '127.0.0.1';
  const port =
    options.port ?? Number(process.env.CALL_CODE_WEB_PORT ?? DEFAULT_PORT);

  const httpServer = createServer((req, res) => {
    void serveStatic(req, res, clientDir);
  });

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  wss.on('connection', (socket) => {
    socket.on('message', (raw) => {
      const text = typeof raw === 'string' ? raw : raw.toString();
      const message = parseClientMessage(text);
      if (!message) {
        sendJson(socket, { type: 'error', message: '无法解析请求消息' });
        return;
      }

      sendJson(socket, {
        type: 'sessions.snapshot',
        data: buildWebExport(store),
      });
    });
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    httpServer.once('error', rejectListen);
    httpServer.listen(port, host, () => {
      httpServer.off('error', rejectListen);
      resolveListen();
    });
  });

  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('无法获取 Web 服务端口');
  }

  return {
    host,
    port: address.port,
    async close() {
      for (const client of wss.clients) {
        client.terminate();
      }
      await new Promise<void>((resolveClose) => {
        wss.close(() => resolveClose());
      });
      await new Promise<void>((resolveClose, rejectClose) => {
        httpServer.close((error) => {
          if (error) {
            rejectClose(error);
          } else {
            resolveClose();
          }
        });
      });
    },
  };
};
