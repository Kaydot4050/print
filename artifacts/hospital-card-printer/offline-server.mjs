import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)));
const publicDirectory = [
  resolve(appDirectory, 'public'),
  resolve(appDirectory, 'dist/public'),
].find((directory) => existsSync(directory));
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

if (!publicDirectory) {
  console.error('Built files were not found. The offline ZIP should contain a public folder.');
  process.exit(1);
}

function safeFilePath(requestPath) {
  const decodedPath = decodeURIComponent(requestPath.split('?')[0] || '/');
  const requestedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const filePath = resolve(publicDirectory, `.${normalize(requestedPath)}`);
  return filePath.startsWith(publicDirectory) ? filePath : null;
}

const server = createServer((request, response) => {
  const requestedPath = request.url ?? '/';
  let filePath;

  try {
    filePath = safeFilePath(requestedPath);
  } catch {
    response.writeHead(400);
    response.end('Bad request');
    return;
  }

  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  // Fall back to the app shell so direct local links continue to work.
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    filePath = join(publicDirectory, 'index.html');
  }

  response.writeHead(200, {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Hospital Card Printer available at http://localhost:${port}`);
  console.log(`Other computers can use http://<this-computer-ip>:${port}`);
});