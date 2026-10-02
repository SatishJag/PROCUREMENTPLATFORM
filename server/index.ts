import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import * as modules from '@satishjag/procurement-core';
import { run } from '../sample/demo.ts';
import { demoSeed } from '../sample/seed.ts';

// RPC over HTTP: POST /api/<module>/<command> { "args": [...] }. Only each module's
// `commands` export is reachable. GET /api lists them.
type Command = (p: modules.Platform, user: unknown, ...args: unknown[]) => unknown;
const registry = Object.fromEntries(Object.entries(modules)
  .filter(([, m]) => typeof m === 'object' && 'commands' in m)
  .map(([name, m]) => [name, (m as { commands: Record<string, Command> }).commands]));
const MAX_BODY = 1_000_000;

export function serve(p = modules.createPlatform(demoSeed()), port = Number(process.env.PORT ?? 8787)) {
  return createServer(async (req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'GET' && req.url === '/api') {
      return send(200, { ok: true, data: Object.fromEntries(Object.entries(registry).map(([m, c]) => [m, Object.keys(c)])) });
    }
    const route = req.url?.match(/^\/api\/(\w+)\/(\w+)$/);
    // Own-property lookups only: /api/constructor/assign must not reach Object.assign.
    const [, mod = '', cmd = ''] = route ?? [];
    const command = req.method === 'POST' && Object.hasOwn(registry, mod) && Object.hasOwn(registry[mod], cmd) ? registry[mod][cmd] : undefined;
    if (!command) return send(404, { ok: false, error: 'Unknown endpoint' });
    // ponytail: x-user-id stands in for Entra ID sign-in. Replace before any real data or network exposure.
    const user = p.users.get(String(req.headers['x-user-id']));
    if (!user) return send(401, { ok: false, error: 'Unknown user' });
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > MAX_BODY) return send(413, { ok: false, error: 'Request too large' });
    }
    try {
      const { args = [] } = body ? JSON.parse(body) : {};
      send(200, { ok: true, data: await command(p, user, ...args) });
    } catch (e) {
      send(400, { ok: false, error: (e as Error).message });
    }
  }).listen(port, process.env.HOST ?? '127.0.0.1'); // set HOST=0.0.0.0 on a host like Railway
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = serve(run(() => {}, true).p); // ponytail: scripted mid-process state for the UI, swap for Postgres data
  server.on('listening', () => { const a = server.address() as { address: string; port: number }; console.log(`API on http://${a.address}:${a.port}/api`); });
}
