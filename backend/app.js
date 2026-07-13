/**
 * Invitation Studio backend application bootstrap.
 * Wires database startup, OpenAPI, SPA/static routes, and API routing.
 */
const http = require("http");
const path = require("path");
const { config } = require("./config");
const { createOpenApi } = require("./openapi");
const { initializeDatabase } = require("./database");
const { handleApi } = require("./apis");
const { appRoot, sendJson, serveFile, serveHtmlTemplate } = require("./utils/http");
const { swaggerPage } = require("./utils/swagger-page");

const pageRoutes = new Set(config.routing.pageRoutes);

async function start() {
  await initializeDatabase();

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || `127.0.0.1:${config.app.port}`}`);
      const pathname = url.pathname.replace(/\/+$/, "") || "/";

      if (request.method === "OPTIONS") {
        sendJson(response, 204, null);
        return;
      }
      if (request.method === "GET" && pathname === "/openapi.json") {
        sendJson(response, 200, createOpenApi(config.app.host, config.app.port));
        return;
      }
      if (request.method === "GET" && pathname === "/api-docs") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(swaggerPage());
        return;
      }
      if (pathname.startsWith("/api/") && await handleApi(request, response, pathname)) return;
      if (request.method === "GET" && pageRoutes.has(pathname)) {
        serveHtmlTemplate(response, path.join(appRoot, "index.html"));
        return;
      }
      if (request.method === "GET" && pathname.startsWith(config.routing.shareRoutePrefix)) {
        serveHtmlTemplate(response, path.join(appRoot, "index.html"));
        return;
      }
      if (request.method === "GET") {
        const filePath = path.normalize(path.join(appRoot, pathname));
        if (filePath.startsWith(appRoot)) {
          serveFile(response, filePath);
          return;
        }
      }
      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      console.error(error);
      sendJson(response, 500, { error: "Unexpected server error" });
    }
  });

  server.listen(config.app.port, config.app.host, () => {
    console.log(`Invitation Studio ready at http://${config.app.host}:${config.app.port}`);
    console.log(`Swagger UI ready at http://${config.app.host}:${config.app.port}/api-docs`);
  });

  return server;
}

module.exports = { start };
