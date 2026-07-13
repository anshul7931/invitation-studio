/**
 * Shared HTTP helpers used by backend route modules.
 * Keeps JSON parsing, JSON responses, and static/template rendering consistent.
 */
const fs = require("fs");
const path = require("path");
const { config } = require("../config");

const appRoot = path.join(__dirname, "..", "..");

function sendJson(response, status, value, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    ...headers
  });
  response.end(status === 204 ? undefined : JSON.stringify(value, null, 2));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > config.api.maxJsonBodyBytes) request.destroy();
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function serveFile(response, filePath) {
  fs.readFile(filePath, (error, contents) => {
    if (error) {
      sendJson(response, error.code === "ENOENT" ? 404 : 500, {
        error: error.code === "ENOENT" ? "Not found" : "Unable to load resource"
      });
      return;
    }
    response.writeHead(200, {
      "Content-Type": config.staticFiles.contentTypes[path.extname(filePath)] || config.staticFiles.fallbackContentType,
      "Cache-Control": "no-store"
    });
    response.end(contents);
  });
}

function renderHtmlWithIncludes(filePath, seen = new Set()) {
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(appRoot)) {
    throw new Error("Template include path is outside the application directory.");
  }
  if (seen.has(normalized)) {
    throw new Error(`Circular template include detected for ${path.relative(appRoot, normalized)}`);
  }
  seen.add(normalized);

  const template = fs.readFileSync(normalized, "utf8");
  const rendered = template.replace(/<!--\s*@include\s+([^>]+?)\s*-->/g, (_match, includePath) => {
    const includeFile = path.normalize(path.join(appRoot, includePath.trim()));
    return renderHtmlWithIncludes(includeFile, seen);
  });
  seen.delete(normalized);
  return rendered;
}

function serveHtmlTemplate(response, filePath) {
  try {
    const html = renderHtmlWithIncludes(filePath);
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end(html);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Unable to render page template" });
  }
}

module.exports = {
  appRoot,
  readJson,
  renderHtmlWithIncludes,
  sendJson,
  serveFile,
  serveHtmlTemplate
};
