import { Injectable, NestMiddleware } from '@nestjs/common';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

// V19: Prefix-Preserved Gateway - Seeding the filter INSIDE the proxy
// This ensures that when we mount it at root in main.ts, the /chat prefix is NOT stripped.
export const chatProxyInstance = createProxyMiddleware('/chat', {
  target: 'http://rocketchat:3000', // NO trailing slash to avoid double-slash conflicts
  changeOrigin: true,
  ws: true,
  logger: console,
  on: {
    proxyReq: (proxyReq, req: any) => {
      // THE V18 FIX: Re-stream the body if it was already consumed by NestJS
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
    // This is now redundant since main.ts handles the global mount, 
    // but we keep it here for architectural consistency if needed.
    if (req.url.startsWith('/chat')) {
      // @ts-ignore - Direct execution of the proxy instance
      return chatProxyInstance(req, res, next);
    }
    next();
  }
}
