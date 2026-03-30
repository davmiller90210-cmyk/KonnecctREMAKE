import { Injectable, NestMiddleware } from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';

// V17: We export the instance so main.ts can access its .upgrade() method directly
export const chatProxyInstance = createProxyMiddleware({
  target: 'http://rocketchat:3000',
  changeOrigin: true,
  ws: true, // Internal WebSocket support for proxy
  logger: console,
  pathRewrite: {
    '^/chat$': '/chat/', // Force trailing slash INTERNALLY to avoid 301 -> 405 GET downgrade
    '^/chat/': '/chat/',
  },
  on: {
    proxyReq: (proxyReq) => {
      // Internal Rocket.Chat protocol handshake
      proxyReq.setHeader('X-Forwarded-Prefix', '/chat');
    },
    error: (err, req, res: any) => {
      console.error('Chat Gateway Proxy Error:', err);
      if (res.status && !res.headersSent) {
        res.status(502).send('Chat Gateway Protocol Error');
      }
    },
  },
});

@Injectable()
export class ChatProxyMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    if (req.url.startsWith('/chat')) {
      // @ts-ignore - Direct execution of the proxy instance
      return chatProxyInstance(req, res, next);
    }
    next();
  }
}
