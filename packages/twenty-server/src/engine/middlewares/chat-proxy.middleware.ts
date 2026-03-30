import { Injectable, NestMiddleware } from '@nestjs/common';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

// V18: Bulletproof Gateway - Restoring the POST stream for Rocket.Chat
export const chatProxyInstance = createProxyMiddleware({
  target: 'http://rocketchat:3000',
  changeOrigin: true,
  ws: true,
  logger: console,
  pathRewrite: {
    '^/chat': '/chat', // Preserve the path
  },
  on: {
    proxyReq: (proxyReq, req: any) => {
      // THE CRITICAL FIX: Re-stream the body if it was already consumed by NestJS
      fixRequestBody(proxyReq, req);
      proxyReq.setHeader('X-Forwarded-Prefix', '/chat');
    },
    error: (err, req, res: any) => {
      console.error('Chat Gateway Protocol Error:', err);
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
