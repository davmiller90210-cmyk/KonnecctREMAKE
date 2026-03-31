import { Injectable, NestMiddleware } from '@nestjs/common';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

// V20: EMERGENCY RESCUE - V3-Strict Signature
// The 502 was caused by the legacy positional argument. V3 requires pathFilter in the options object.
export const chatProxyInstance = createProxyMiddleware({
  target: 'http://rocketchat:3000', // NO trailing slash
  changeOrigin: true,
  pathFilter: ['/chat', '/chat/**'], // V22: Expanded catch-all
  pathRewrite: { '^/chat' : '/chat' }, // V22: Strict mapping hardening
  ws: true,
  xfwd: true, // V22: Helping Meteor identify the proxy correcty
  logger: console,
  on: {
    proxyReq: (proxyReq, req: any) => {
      // Body restoration for POST requests
      fixRequestBody(proxyReq, req);
      proxyReq.setHeader('X-Forwarded-Prefix', '/chat');
    },
    error: (err, req, res: any) => {
      console.error('Chat Gateway Protocol Error:', err);
      if (res.status && !res.headersSent) {
        res.status(502).send('Chat Gateway Protocol Failure');
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
