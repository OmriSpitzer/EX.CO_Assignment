import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));

export function distIndexPath() {
  return path.resolve(serverDir, "../client/dist/index.html");
}

export function pageData() {
  return {
    message: process.env.APP_MESSAGE || "Unknown message",
    version: process.env.APP_VERSION || "Unknown version",
    podName: process.env.HOSTNAME || os.hostname(),
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function renderFacts(data) {
  return `<main><h1 id="message">${escapeHtml(data.message)}</h1><p id="version">Version: ${escapeHtml(data.version)}</p><p id="pod">Pod: ${escapeHtml(data.podName)}</p></main>`;
}

export function renderHtml(data) {
  const boot = JSON.stringify(data).replace(/</g, "\\u003c");
  const facts = renderFacts(data);
  const indexPath = distIndexPath();

  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, "utf8");
    return html
      .replace("</head>", `<script>window.__BOOT__=${boot}</script></head>`)
      .replace('<div id="root"></div>', `<div id="root">${facts}</div>`);
  }

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>EX.CO</title><script>window.__BOOT__=${boot}</script></head><body><div id="root">${facts}</div></body></html>`;
}

export function createApp() {
  const app = express();

  app.get("/healthz", (_req, res) => {
    res.status(200).type("text/plain").send("ok");
  });

  app.get("/", (_req, res) => {
    res.status(200).type("html").send(renderHtml(pageData()));
  });

  const distDir = path.dirname(distIndexPath());
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
  }

  return app;
}
