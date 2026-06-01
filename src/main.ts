/**
 * Process Discovery Assistant — main entry point.
 * Starts the web server.
 */

import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { router } from "./web/router.js";
import { getConfig, loadConfigFromFile, isDeepseekConfigured } from "./config.js";

loadConfigFromFile();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const config = getConfig();

app.use(express.json());

// Lightweight request observability: log API calls with status + latency.
// (Static asset noise is excluded.) Engineering cybernetics: observable I/O.
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const flag = res.statusCode >= 500 ? "✗" : res.statusCode >= 400 ? "!" : "·";
    console.log(`${flag} ${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// Serve built React client if available, otherwise fallback to static/
const clientDist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: all non-API routes go to index.html
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  app.use(express.static(path.join(__dirname, "..", "static")));
  app.get("/", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "static", "index.html"));
  });
}

// API routes
app.use(router);

app.listen(config.port, () => {
  console.log(`Process Discovery Assistant running at http://localhost:${config.port}`);
  console.log("DeepSeek API:", isDeepseekConfigured() ? "configured" : "NOT configured — set deepseekApiKey in config.json");
});
