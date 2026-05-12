import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distRoot = path.join(projectRoot, "dist");
const port = Number(process.env.PORT || 4173);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".ttf", "font/ttf"],
  [".mp4", "video/mp4"]
]);

function safeJoin(root, requestPath) {
  const cleaned = decodeURIComponent(requestPath.split("?")[0]).replace(/^\/+/, "");
  const fullPath = path.resolve(root, cleaned);
  if (!fullPath.startsWith(root)) {
    return null;
  }
  return fullPath;
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url;
  const candidate = safeJoin(distRoot, urlPath || "/index.html");
  if (!candidate) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  let filePath = candidate;
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    if (!path.extname(filePath)) {
      filePath = path.join(filePath, "index.html");
    }
  }

  try {
    const content = await fs.readFile(filePath);
    const mime = mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(content);
  } catch {
    try {
      const fallback = await fs.readFile(path.join(distRoot, "404.html"));
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(fallback);
    } catch {
      res.writeHead(404);
      res.end("Not Found");
    }
  }
});

server.listen(port, () => {
  console.log(`Preview server: http://127.0.0.1:${port}`);
});
