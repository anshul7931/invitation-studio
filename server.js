const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { occasions } = require("./server/occasion-data");
const { createOpenApi } = require("./server/openapi");
const { initializeDatabase, database } = require("./server/database");
const {
  hashPassword,
  verifyPassword,
  createSession,
  currentUser,
  destroySession,
  sessionCookie,
  clearSessionCookie
} = require("./server/auth");

const port = Number(process.env.PORT) || 3000;
const pageRoutes = new Set(["/", "/login", "/wedding", "/birthday", "/engagement", "/office"]);

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
      if (body.length > 1_000_000) request.destroy();
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
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  };
  fs.readFile(filePath, (error, contents) => {
    if (error) {
      sendJson(response, error.code === "ENOENT" ? 404 : 500, {
        error: error.code === "ENOENT" ? "Not found" : "Unable to load resource"
      });
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(contents);
  });
}

function swaggerPage() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Invitation Studio API</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head>
<body><div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:"/openapi.json",dom_id:"#swagger-ui",deepLinking:true,withCredentials:true});</script>
</body></html>`;
}

function invitationTitle(occasion, fields) {
  if (occasion === "wedding") return `${fields.bride} & ${fields.groom}`;
  if (occasion === "birthday") return `${fields.celebrant}'s Birthday`;
  if (occasion === "engagement") return `${fields.partnerOne} & ${fields.partnerTwo}`;
  return fields.eventName;
}

function invitationDto(row) {
  return {
    id: row.id,
    occasion: row.occasion,
    title: row.title,
    fields: typeof row.fields === "string" ? JSON.parse(row.fields) : row.fields,
    url: `/${row.occasion}?id=${row.id}`,
    shareUrl: `/share/${row.share_token}`,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

async function requireUser(request, response) {
  const user = await currentUser(request);
  if (!user) sendJson(response, 401, { error: "Authentication required" });
  return user;
}

async function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/auth/me") {
    const user = await currentUser(request);
    sendJson(response, 200, { user });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/register") {
    const body = await readJson(request);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!name || !email || password.length < 8) {
      sendJson(response, 400, {
        error: "Name, email, and a password of at least 8 characters are required."
      });
      return true;
    }
    const [existing] = await database().execute("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length) {
      sendJson(response, 409, { error: "An account with this email already exists." });
      return true;
    }
    const user = { id: crypto.randomUUID(), name, email };
    await database().execute(
      "INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)",
      [user.id, name, email, await hashPassword(password)]
    );
    const session = await createSession(user.id);
    sendJson(response, 201, { user }, { "Set-Cookie": sessionCookie(session.token, session.expiresAt) });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    const body = await readJson(request);
    const email = String(body.email || "").trim().toLowerCase();
    const [rows] = await database().execute(
      "SELECT id, name, email, password_hash FROM users WHERE email = ?",
      [email]
    );
    const account = rows[0];
    if (!account || !(await verifyPassword(String(body.password || ""), account.password_hash))) {
      sendJson(response, 401, { error: "Invalid email or password." });
      return true;
    }
    const session = await createSession(account.id);
    sendJson(
      response,
      200,
      { user: { id: account.id, name: account.name, email: account.email } },
      { "Set-Cookie": sessionCookie(session.token, session.expiresAt) }
    );
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    await destroySession(request);
    sendJson(response, 200, { success: true }, { "Set-Cookie": clearSessionCookie() });
    return true;
  }

  if (request.method === "PUT" && pathname === "/api/profile") {
    const user = await requireUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    const name = String(body.name || "").trim();
    if (!name) {
      sendJson(response, 400, { error: "Name is required." });
      return true;
    }
    await database().execute("UPDATE users SET name = ? WHERE id = ?", [name, user.id]);
    sendJson(response, 200, { user: { ...user, name } });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/occasions") {
    sendJson(response, 200, {
      occasions: Object.entries(occasions).map(([id, config]) => ({
        id, required: config.required, defaults: config.defaults
      }))
    });
    return true;
  }

  const configMatch = pathname.match(/^\/api\/occasions\/([^/]+)$/);
  if (request.method === "GET" && configMatch) {
    const config = occasions[configMatch[1]];
    sendJson(response, config ? 200 : 404, config || { error: "Unknown occasion" });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/invitations") {
    const user = await requireUser(request, response);
    if (!user) return true;
    const [rows] = await database().execute(
      "SELECT * FROM invitations WHERE user_id = ? ORDER BY updated_at DESC",
      [user.id]
    );
    sendJson(response, 200, { invitations: rows.map(invitationDto) });
    return true;
  }

  const publicMatch = pathname.match(/^\/api\/public\/([^/]+)$/);
  if (request.method === "GET" && publicMatch) {
    const [rows] = await database().execute(
      `SELECT i.*, u.name AS owner_name
       FROM invitations i JOIN users u ON u.id = i.user_id
       WHERE i.share_token = ?`,
      [publicMatch[1]]
    );
    if (!rows[0]) {
      sendJson(response, 404, { error: "Shared invitation not found" });
      return true;
    }
    sendJson(response, 200, { ...invitationDto(rows[0]), owner: rows[0].owner_name, readOnly: true });
    return true;
  }

  const collectionMatch = pathname.match(/^\/api\/invitations\/([^/]+)$/);
  if (request.method === "POST" && collectionMatch) {
    const user = await requireUser(request, response);
    if (!user) return true;
    const occasion = collectionMatch[1];
    const config = occasions[occasion];
    if (!config) {
      sendJson(response, 404, { error: "Unknown occasion" });
      return true;
    }
    const fields = { ...config.defaults, ...(await readJson(request)) };
    const missing = config.required.filter((name) => !String(fields[name] || "").trim());
    if (missing.length) {
      sendJson(response, 400, { error: "Missing required fields", fields: missing });
      return true;
    }
    const id = crypto.randomUUID();
    await database().execute(
      "INSERT INTO invitations (id, user_id, share_token, occasion, title, fields) VALUES (?, ?, ?, ?, ?, ?)",
      [id, user.id, crypto.randomUUID(), occasion, invitationTitle(occasion, fields), JSON.stringify(fields)]
    );
    const [rows] = await database().execute(
      "SELECT * FROM invitations WHERE id = ? AND user_id = ?",
      [id, user.id]
    );
    sendJson(response, 201, invitationDto(rows[0]));
    return true;
  }

  const itemMatch = pathname.match(/^\/api\/invitations\/([^/]+)\/([^/]+)$/);
  if (itemMatch) {
    const user = await requireUser(request, response);
    if (!user) return true;
    const [rows] = await database().execute(
      "SELECT * FROM invitations WHERE id = ? AND occasion = ? AND user_id = ?",
      [itemMatch[2], itemMatch[1], user.id]
    );
    if (!rows[0]) {
      sendJson(response, 404, { error: "Invitation not found" });
      return true;
    }

    if (request.method === "GET") {
      sendJson(response, 200, invitationDto(rows[0]));
      return true;
    }
    if (request.method === "PUT") {
      const config = occasions[itemMatch[1]];
      const fields = { ...(typeof rows[0].fields === "string" ? JSON.parse(rows[0].fields) : rows[0].fields), ...(await readJson(request)) };
      const missing = config.required.filter((name) => !String(fields[name] || "").trim());
      if (missing.length) {
        sendJson(response, 400, { error: "Missing required fields", fields: missing });
        return true;
      }
      await database().execute(
        "UPDATE invitations SET title = ?, fields = ? WHERE id = ? AND user_id = ?",
        [invitationTitle(itemMatch[1], fields), JSON.stringify(fields), itemMatch[2], user.id]
      );
      const [updated] = await database().execute("SELECT * FROM invitations WHERE id = ?", [itemMatch[2]]);
      sendJson(response, 200, invitationDto(updated[0]));
      return true;
    }
    if (request.method === "DELETE") {
      await database().execute("DELETE FROM invitations WHERE id = ? AND user_id = ?", [itemMatch[2], user.id]);
      sendJson(response, 204, null);
      return true;
    }
  }

  return false;
}

async function start() {
  await initializeDatabase();

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || `127.0.0.1:${port}`}`);
      const pathname = url.pathname.replace(/\/+$/, "") || "/";

      if (request.method === "OPTIONS") {
        sendJson(response, 204, null);
        return;
      }
      if (request.method === "GET" && pathname === "/openapi.json") {
        sendJson(response, 200, createOpenApi(port));
        return;
      }
      if (request.method === "GET" && pathname === "/api-docs") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(swaggerPage());
        return;
      }
      if (pathname.startsWith("/api/") && await handleApi(request, response, pathname)) return;
      if (request.method === "GET" && pageRoutes.has(pathname)) {
        serveFile(response, path.join(__dirname, "index.html"));
        return;
      }
      if (request.method === "GET" && pathname.startsWith("/share/")) {
        serveFile(response, path.join(__dirname, "index.html"));
        return;
      }
      if (request.method === "GET") {
        const filePath = path.normalize(path.join(__dirname, pathname));
        if (filePath.startsWith(__dirname)) {
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

  server.listen(port, "127.0.0.1", () => {
    console.log(`Invitation Studio ready at http://127.0.0.1:${port}`);
    console.log(`Swagger UI ready at http://127.0.0.1:${port}/api-docs`);
  });
}

start().catch((error) => {
  console.error("Unable to start Invitation Studio:", error.message);
  process.exitCode = 1;
});
