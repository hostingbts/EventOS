/**
 * Dev-only proxy: browser → localhost/api/proxy → Google Apps Script.
 * Avoids CORS "NetworkError" when POSTing from localhost to script.google.com.
 */
import type { Plugin } from 'vite';
import type { IncomingMessage } from 'node:http';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function gasProxyPlugin(apiUrl: string, apiToken: string): Plugin {
  return {
    name: 'gas-proxy',
    configureServer(server) {
      if (!apiUrl || !apiToken) {
        server.config.logger.warn(
          '[gas-proxy] Skipped — set VITE_API_URL and VITE_API_TOKEN in web/.env.local',
        );
        return;
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/proxy')) return next();

        try {
          const localUrl = new URL(req.url, 'http://localhost');
          const action = localUrl.searchParams.get('action') || 'list';

          const target = new URL(apiUrl);
          target.searchParams.set('action', action);
          target.searchParams.set('token', apiToken);
          localUrl.searchParams.forEach((value, key) => {
            if (key !== 'action') target.searchParams.set(key, value);
          });

          if (req.method === 'POST') {
            const raw = await readBody(req);
            const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
            const upstream = await fetch(target.toString(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...parsed, action, token: apiToken }),
            });
            const text = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(text);
            return;
          }

          const upstream = await fetch(target.toString());
          const text = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(text);
        } catch (err) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Proxy error',
            }),
          );
        }
      });
    },
  };
}
