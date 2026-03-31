import { Injectable, NestMiddleware } from '@nestjs/common';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

// V20/V32: EMERGENCY RESCUE - Absolute Priority
export const chatProxyInstance = createProxyMiddleware({
  target: 'http://rocketchat:3000',
  changeOrigin: true,
  pathFilter: (path) => path.startsWith('/chat/'), // V32: Capturing the iframe content path specifically
  pathRewrite: { '^/chat' : '/chat' },
  ws: true,
  xfwd: true,
  logger: console,
  on: {
    proxyReq: (proxyReq, req: any) => {
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
