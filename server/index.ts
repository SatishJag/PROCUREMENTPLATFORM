import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as modules from '@satishjag/procurement-core';
import { run, type Stage } from '../sample/demo.ts';
import { demoSeed } from '../sample/seed.ts';

// RPC over HTTP: POST /api/<module>/<command> { "args": [...] }. Only each module's
// `commands` export is reachable. GET /api lists them.
type Command = (p: modules.Platform, user: unknown, ...args: unknown[]) => unknown;
const registry = Object.fromEntries(Object.entries(modules)
  .filter(([, m]) => typeof m === 'object' && 'commands' in m)
  .map(([name, m]) => [name, (m as { commands: Record<string, Command> }).commands]));
const MAX_BODY = 1_000_000;

// Built web app (`npm run build`), served from the same origin so one URL shows UI and API.
// ponytail: sync reads, no caching headers; put a CDN or static host in front for real traffic.
const DIST = fileURLToPath(new URL('../web/dist/', import.meta.url));
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };
function staticFile(url: string) {
  let path: string;
  try { path = normalize(join(DIST, decodeURIComponent(url.split('?')[0]))); } catch { return undefined; }
  if (!path.startsWith(DIST)) return undefined; // no escaping the dist folder
  const file = existsSync(path) && statSync(path).isFile() ? path : join(DIST, 'index.html');
  return existsSync(file) ? { file, type: MIME[extname(file)] ?? 'application/octet-stream' } : undefined;
}

export function serve(p = modules.createPlatform(demoSeed()), port = Number(process.env.PORT ?? 8787)) {
  return createServer(async (req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'GET' && req.url === '/api') {
      return send(200, { ok: true, data: Object.fromEntries(Object.entries(registry).map(([m, c]) => [m, Object.keys(c)])) });
    }
    if (req.method === 'GET' && !req.url?.startsWith('/api')) {
      const f = staticFile(req.url ?? '/');
      if (!f) return send(404, { ok: false, error: 'Not found. Build the web app with `npm run build`.' });
      res.writeHead(200, { 'content-type': f.type });
      return res.end(readFileSync(f.file));
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
  }).listen(port, process.env.HOST ?? (process.env.PORT ? '0.0.0.0' : '127.0.0.1')); // hosts like Railway set PORT and need all interfaces; local dev stays loopback
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // ponytail: scripted state for the UI (DEMO_STAGE=start|package|draft|bids|technical|commercial|award, default award), swap for Postgres data.
  const stage = process.env.DEMO_STAGE ?? 'award';
  const server = serve(stage === 'start' ? undefined : run(() => {}, stage as Stage).p);
  server.on('listening', () => { const a = server.address() as { address: string; port: number }; console.log(`API on http://${a.address}:${a.port}/api`); });
}
