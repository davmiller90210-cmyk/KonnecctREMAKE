import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

// V32/V40: DECOUPLED PROXY - Moving to /rc-proxy to avoid SPA route collision
export const chatProxyInstance = createProxyMiddleware('/rc-proxy', {
  target: 'http://rocketchat:3000',
  changeOrigin: true,
  // Ensure the /rc-proxy prefix is preserved when talking to Rocket.Chat (as ROOT_URL includes it)
  pathRewrite: { '^/rc-proxy' : '/rc-proxy' },
  ws: true,
  xfwd: true,
  logger: console,
  on: {
    proxyReq: (proxyReq, req: any) => {
      fixRequestBody(proxyReq, req);
      proxyReq.setHeader('X-Forwarded-Prefix', '/rc-proxy');
    },
    error: (err, req, res: any) => {
      console.error('Chat Gateway Protocol Error:', err);
      if (res.status && !res.headersSent) {
        res.status(502).send('Chat Gateway Protocol Failure');
      }
    },
  },
});
