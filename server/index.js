'use strict';
/* ============================================================
   Claud — server entry.
   Serves the static React frontend (public/) and the JSON API
   (/api/*). Single process, single port, zero external deps.
   ============================================================ */

// ---- Node version guard (node:sqlite needs Node >= 22.5) ----
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 22 || (maj === 22 && min < 5)) {
  console.error(`\nClaud needs Node.js 22.5 or newer (you have ${process.versions.node}).`);
  console.error('Install the latest LTS from https://nodejs.org and try again.\n');
  process.exit(1);
}

const http = require('node:http');
const path = require('node:path');
const { createRouter, sendJson, sendError, readBody, safeJoin, serveFile, HttpError } = require('./lib/http');
const { register } = require('./routes');
const { DB_PATH } = require('./lib/db');

const PORT = process.env.PORT || 4317;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const router = createRouter();
register(router);

// Clean URLs for the page shells.
const PAGES = {
  '/': 'landing.html',
  '/app': 'app.html',
  '/dashboard': 'app.html',
  '/upgrade': 'upgrade.html',
  '/legal': 'legal.html',
  '/login': 'landing.html'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    /* ---- API ---- */
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      const m = router.match(req.method, pathname);
      if (!m) return sendError(res, 404, 'No such endpoint');
      let body = {};
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) body = await readBody(req);
      const ctx = {
        params: m.params,
        body,
        query: url.searchParams,
        user: null,
        json: (status, obj) => sendJson(res, status, obj)
      };
      await m.handler(req, res, ctx);
      return;
    }

    /* ---- Page shells (clean URLs) ---- */
    if (req.method === 'GET' && PAGES[pathname]) {
      if (serveFile(res, path.join(PUBLIC_DIR, PAGES[pathname]))) return;
      return sendError(res, 404, 'Page not found');
    }

    /* ---- Static assets ---- */
    if (req.method === 'GET' || req.method === 'HEAD') {
      const fp = safeJoin(PUBLIC_DIR, pathname);
      if (fp && serveFile(res, fp)) return;
      // SPA-ish fallback: unknown non-asset path -> landing
      if (!path.extname(pathname)) {
        if (serveFile(res, path.join(PUBLIC_DIR, 'landing.html'))) return;
      }
      return sendError(res, 404, 'Not found');
    }

    sendError(res, 405, 'Method not allowed');
  } catch (err) {
    if (err instanceof HttpError) return sendError(res, err.status, err.message, err.extra);
    console.error('Unhandled error:', err);
    return sendError(res, 500, 'Something went wrong on the server');
  }
});

server.listen(PORT, () => {
  console.log(`\n  Claud is running.`);
  console.log(`  ▸ Open http://localhost:${PORT}`);
  console.log(`  ▸ Database: ${DB_PATH}`);
  console.log(`  ▸ Press Ctrl+C to stop.\n`);
});
