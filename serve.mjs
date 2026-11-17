#!/usr/bin/env node
/**
 * 本地预览服务器：node serve.mjs [端口]
 * 默认 http://127.0.0.1:8787
 * 只做静态文件服务；data/meta.json 不缓存，方便验证「实时更新」。
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 8787);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath.endsWith("/")) urlPath += "index.html";
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end("forbidden"); return }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("404 " + urlPath); return }
    const ext = path.extname(file).toLowerCase();
    const noCache = ext === ".json" || ext === ".html";
    res.writeHead(200, {
      "content-type": MIME[ext] || "application/octet-stream",
      "cache-control": noCache ? "no-store" : "public, max-age=3600",
    });
    res.end(buf);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`图鉴站点: http://127.0.0.1:${PORT}/`);
  console.log(`同一局域网可用手机访问: http://<这台机器的 IP>:${PORT}/`);
});
