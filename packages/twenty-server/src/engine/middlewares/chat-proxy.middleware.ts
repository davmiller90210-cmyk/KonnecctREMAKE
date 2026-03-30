import { Injectable, NestMiddleware } from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';

@Injectable()
export class ChatProxyMiddleware implements NestMiddleware {
  private proxy = createProxyMiddleware({
    target: 'http://rocketchat:3000',
    changeOrigin: true,
    ws: true,
    logger: console,
    pathRewrite: {
      '^/chat': '/chat', // Preserve the /chat prefix for Rocket.Chat's internal routing
    },
    on: {
      proxyReq: (proxyReq) => {
        // Ensure Rocket.Chat knows it is behind a /chat subpath
        proxyReq.setHeader('X-Forwarded-Prefix', '/chat');
      },
      error: (err, req, res: any) => {
        console.error('Chat Gateway Proxy Error:', err);
        if (res.status && !res.headersSent) {
          res.status(502).send('Chat Gateway (Singular Backend) Connection Error');
        }
      },
    },
  });

  use(req: any, res: any, next: () => void) {
    // Only proxy if the path starts with /chat
    if (req.url.startsWith('/chat')) {
      return this.proxy(req, res, next);
    }
    next();
  }
}
