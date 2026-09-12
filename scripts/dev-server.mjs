import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 8000);
const host = '127.0.0.1';

function readEnvFile(name) {
  try {
    const text = readFileSync(path.join(root, name), 'utf8');
    return Object.fromEntries(text.split(/\r?\n/).flatMap(line => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) return [];
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return [[match[1], value]];
    }));
  } catch {
    return {};
  }
}

const env = {...readEnvFile('.env'), ...readEnvFile('.env.local'), ...process.env};
const password = env.COOKING_HOUSEHOLD_PASSWORD || '';

function send(res, status, type, body) {
  res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store'});
  res.end(body);
}

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${host}:${port}`);
    if (url.pathname === '/__dev/auth.json') {
      send(res, 200, 'application/json; charset=utf-8', JSON.stringify({password: password || null}));
      return;
    }

    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = path.resolve(root, `.${requested}`);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      send(res, 403, 'text/plain; charset=utf-8', 'Forbidden');
      return;
    }
    const info = await stat(filePath);
    const finalPath = info.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    const body = await readFile(finalPath);
    send(res, 200, mime[path.extname(finalPath)] || 'application/octet-stream', body);
  } catch (error) {
    send(res, error.code === 'ENOENT' ? 404 : 500, 'text/plain; charset=utf-8', error.code === 'ENOENT' ? 'Not found' : 'Server error');
  }
});

server.listen(port, host, () => {
  console.log(`Dinner, sorted local server: http://${host}:${port}`);
  console.log(password ? 'Local auto-unlock is enabled.' : 'Local auto-unlock is disabled; set COOKING_HOUSEHOLD_PASSWORD in .env.local.');
});
