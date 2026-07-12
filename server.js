/**
 * Invitation Studio HTTP entry point.
 * Handles static SPA routes, authentication APIs, invitation CRUD, public share
 * links, admin APIs, and Swagger/OpenAPI endpoints.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { config } = require("./server/config");
const { occasions } = require("./server/occasion-schema");
const { createOpenApi } = require("./server/openapi");
const { initializeDatabase, database } = require("./server/database");
const { sendTransactionalEmail } = require("./server/email/service");
const {
  hashPassword,
  verifyPassword,
  createSession,
  currentUser,
  destroySession,
  sessionCookie,
  clearSessionCookie
} = require("./server/auth");

const port = config.app.port;
const host = config.app.host;
const pageRoutes = new Set(config.routing.pageRoutes);

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
  if (!normalized.startsWith(__dirname)) {
    throw new Error("Template include path is outside the application directory.");
  }
  if (seen.has(normalized)) {
    throw new Error(`Circular template include detected for ${path.relative(__dirname, normalized)}`);
  }
  seen.add(normalized);

  const template = fs.readFileSync(normalized, "utf8");
  const rendered = template.replace(/<!--\s*@include\s+([^>]+?)\s*-->/g, (_match, includePath) => {
    const includeFile = path.normalize(path.join(__dirname, includePath.trim()));
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
  const schema = occasions[occasion];
  const title = schema.titleFields
    .map((field) => String(fields[field] || "").trim())
    .filter(Boolean)
    .join(" & ");
  return `${title}${schema.titleSuffix || ""}`;
}

function invitationDto(row) {
  const publicExpiresAt = row.public_expires_at ? new Date(row.public_expires_at) : null;
  return {
    id: row.id,
    occasion: row.occasion,
    title: row.title,
    fields: typeof row.fields === "string" ? JSON.parse(row.fields) : row.fields,
    url: `/${row.occasion}?id=${row.id}`,
    shareUrl: row.public_token ? `/share/${row.public_token}` : null,
    publicExpiresAt: publicExpiresAt ? publicExpiresAt.toISOString() : null,
    publicGeneratedAt: row.public_generated_at ? new Date(row.public_generated_at).toISOString() : null,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function userDto(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || "",
    role: row.role,
    emailVerified: Boolean(row.email_verified_at)
  };
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function createEmailToken(userId, email, purpose, expiryMinutes) {
  const token = crypto.randomBytes(32).toString("base64url");
  await database().execute(
    `UPDATE email_tokens
     SET used_at = NOW()
     WHERE user_id = ? AND purpose = ? AND used_at IS NULL`,
    [userId, purpose]
  );
  await database().execute(
    `INSERT INTO email_tokens (id, user_id, email, purpose, token_hash, expires_at)
     VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [crypto.randomUUID(), userId, email, purpose, tokenHash(token), expiryMinutes]
  );
  return token;
}

async function markEmailTokenProviderMessage(token, providerMessageId) {
  if (!providerMessageId) return;
  await database().execute(
    "UPDATE email_tokens SET provider_message_id = ? WHERE token_hash = ?",
    [providerMessageId, tokenHash(token)]
  );
}

async function sendVerificationEmail(user) {
  const token = await createEmailToken(user.id, user.email, "VERIFY_EMAIL", config.email.verifyTokenMinutes);
  const verifyUrl = `${config.app.publicUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const result = await sendTransactionalEmail("VERIFY_EMAIL", {
    to: user.email,
    subject: "Verify your Invitation Studio email",
    html: `
      <p>Hello ${escapeHtml(user.name)},</p>
      <p>Please verify your email address for Invitation Studio.</p>
      <p><a href="${verifyUrl}">Verify email</a></p>
      <p>This link expires in ${config.email.verifyTokenMinutes} minutes.</p>
    `,
    text: `Hello ${user.name}, verify your Invitation Studio email: ${verifyUrl}`,
    idempotencyKey: `verify-${user.id}-${Date.now()}`
  });
  await markEmailTokenProviderMessage(token, result.messageId);
  return result;
}

async function sendPasswordResetEmail(user) {
  const token = await createEmailToken(user.id, user.email, "RESET_PASSWORD", config.email.resetTokenMinutes);
  const resetUrl = `${config.app.publicUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const result = await sendTransactionalEmail("RESET_PASSWORD", {
    to: user.email,
    subject: "Reset your Invitation Studio password",
    html: `
      <p>Hello ${escapeHtml(user.name)},</p>
      <p>Use the link below to reset your Invitation Studio password.</p>
      <p><a href="${resetUrl}">Reset password</a></p>
      <p>This link expires in ${config.email.resetTokenMinutes} minutes.</p>
    `,
    text: `Hello ${user.name}, reset your Invitation Studio password: ${resetUrl}`,
    idempotencyKey: `reset-${user.id}-${Date.now()}`
  });
  await markEmailTokenProviderMessage(token, result.messageId);
  return result;
}

function fingerprintFor(occasion, fields) {
  const importantKeys = occasions[occasion].fingerprintFields;
  const normalized = Object.fromEntries(
    importantKeys.map((key) => [key, String(fields[key] || "").trim().toLowerCase()])
  );
  return crypto.createHash("sha256").update(JSON.stringify({ occasion, normalized })).digest("hex");
}

async function requireUser(request, response) {
  const user = await currentUser(request);
  if (!user) sendJson(response, 401, { error: "Authentication required" });
  return user;
}

async function requireAdmin(request, response) {
  const user = await requireUser(request, response);
  if (!user) return null;
  if (user.role !== "ADMIN") {
    sendJson(response, 403, { error: "Admin access required" });
    return null;
  }
  return user;
}

async function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/auth/me") {
    const user = await currentUser(request);
    sendJson(response, 200, { user: user ? userDto(user) : null });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/register") {
    const body = await readJson(request);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
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
    const role = config.app.adminEmails.includes(email) ? "ADMIN" : "USER";
    const user = { id: crypto.randomUUID(), name, email, phone, role };
    await database().execute(
      "INSERT INTO users (id, name, email, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
      [user.id, name, email, phone || null, role, await hashPassword(password)]
    );
    try {
      await sendVerificationEmail(user);
    } catch (error) {
      console.warn("Verification email was not sent:", error.message);
    }
    const session = await createSession(user.id);
    sendJson(response, 201, { user: userDto({ ...user, email_verified_at: null }) }, { "Set-Cookie": sessionCookie(session.token, session.expiresAt) });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/verify-email/request") {
    const user = await requireUser(request, response);
    if (!user) return true;
    if (user.email_verified_at) {
      sendJson(response, 200, { message: "Email is already verified." });
      return true;
    }
    await sendVerificationEmail(user);
    sendJson(response, 200, { message: "Verification email sent." });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/verify-email") {
    const body = await readJson(request);
    const token = String(body.token || "").trim();
    if (!token) {
      sendJson(response, 400, { error: "Verification token is required." });
      return true;
    }
    const [rows] = await database().execute(
      `SELECT t.*, u.name, u.email AS current_email, u.phone, u.role
       FROM email_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? AND t.purpose = 'VERIFY_EMAIL' AND t.used_at IS NULL AND t.expires_at > NOW()`,
      [tokenHash(token)]
    );
    const record = rows[0];
    if (!record) {
      sendJson(response, 400, { error: "Verification link is invalid or expired." });
      return true;
    }
    await database().execute("UPDATE users SET email_verified_at = NOW() WHERE id = ? AND email = ?", [
      record.user_id,
      record.email
    ]);
    await database().execute("UPDATE email_tokens SET used_at = NOW() WHERE id = ?", [record.id]);
    sendJson(response, 200, {
      message: "Email verified successfully.",
      user: userDto({
        id: record.user_id,
        name: record.name,
        email: record.current_email,
        phone: record.phone,
        role: record.role,
        email_verified_at: new Date()
      })
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/forgot-password") {
    const body = await readJson(request);
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      sendJson(response, 400, { error: "Email is required." });
      return true;
    }
    const [rows] = await database().execute("SELECT id, name, email FROM users WHERE email = ?", [email]);
    if (rows[0]) {
      await sendPasswordResetEmail(rows[0]);
    }
    sendJson(response, 200, {
      message: "If an account exists for this email, a reset link has been sent."
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/reset-password") {
    const body = await readJson(request);
    const token = String(body.token || "").trim();
    const password = String(body.password || "");
    if (!token || password.length < 8) {
      sendJson(response, 400, { error: "A valid reset token and password of at least 8 characters are required." });
      return true;
    }
    const [rows] = await database().execute(
      `SELECT * FROM email_tokens
       WHERE token_hash = ? AND purpose = 'RESET_PASSWORD' AND used_at IS NULL AND expires_at > NOW()`,
      [tokenHash(token)]
    );
    const record = rows[0];
    if (!record) {
      sendJson(response, 400, { error: "Reset link is invalid or expired." });
      return true;
    }
    await database().execute("UPDATE users SET password_hash = ? WHERE id = ?", [
      await hashPassword(password),
      record.user_id
    ]);
    await database().execute("UPDATE email_tokens SET used_at = NOW() WHERE id = ?", [record.id]);
    await database().execute("DELETE FROM sessions WHERE user_id = ?", [record.user_id]);
    sendJson(response, 200, { message: "Password reset successfully. Please sign in again." });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    const body = await readJson(request);
    const email = String(body.email || "").trim().toLowerCase();
    const [rows] = await database().execute(
      "SELECT id, name, email, phone, role, password_hash FROM users WHERE email = ?",
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
      { user: userDto(account) },
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
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    if (!name || !email) {
      sendJson(response, 400, { error: "Name and email are required." });
      return true;
    }
    const [existing] = await database().execute(
      "SELECT id FROM users WHERE email = ? AND id <> ?",
      [email, user.id]
    );
    if (existing.length) {
      sendJson(response, 409, { error: "Another account already uses this email." });
      return true;
    }
    const emailChanged = email !== user.email;
    await database().execute("UPDATE users SET name = ?, email = ?, phone = ?, email_verified_at = ? WHERE id = ?", [
      name,
      email,
      phone || null,
      emailChanged ? null : user.email_verified_at,
      user.id
    ]);
    const updatedUser = { ...user, name, email, phone, email_verified_at: emailChanged ? null : user.email_verified_at };
    if (emailChanged) {
      try {
        await sendVerificationEmail(updatedUser);
      } catch (error) {
        console.warn("Verification email was not sent:", error.message);
      }
    }
    sendJson(response, 200, { user: userDto(updatedUser) });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/admin/stats") {
    const admin = await requireAdmin(request, response);
    if (!admin) return true;
    const [[users]] = await database().query("SELECT COUNT(*) AS count FROM users");
    const [[invitations]] = await database().query("SELECT COUNT(*) AS count FROM invitations");
    const [[published]] = await database().query("SELECT COUNT(*) AS count FROM invitations WHERE public_generated_at IS NOT NULL");
    const [[activeLinks]] = await database().query("SELECT COUNT(*) AS count FROM invitations WHERE public_token IS NOT NULL AND public_expires_at > NOW()");
    sendJson(response, 200, {
      stats: {
        totalUsers: users.count,
        totalInvitations: invitations.count,
        publishedInvitations: published.count,
        activePublicLinks: activeLinks.count
      }
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/admin/users") {
    const admin = await requireAdmin(request, response);
    if (!admin) return true;
    const [rows] = await database().query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at, COUNT(i.id) AS invitation_count
       FROM users u
       LEFT JOIN invitations i ON i.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    sendJson(response, 200, { users: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone || "",
      role: row.role,
      invitationCount: row.invitation_count,
      createdAt: new Date(row.created_at).toISOString()
    })) });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/admin/invitations") {
    const admin = await requireAdmin(request, response);
    if (!admin) return true;
    const userId = new URL(request.url, `http://${host}:${port}`).searchParams.get("userId");
    const sql =
      `SELECT i.*, u.name AS owner_name, u.email AS owner_email
       FROM invitations i JOIN users u ON u.id = i.user_id
       ${userId ? "WHERE i.user_id = ?" : ""}
       ORDER BY i.updated_at DESC`;
    const [rows] = await database().execute(sql, userId ? [userId] : []);
    sendJson(response, 200, {
      invitations: rows.map((row) => ({
        ...invitationDto(row),
        owner: { name: row.owner_name, email: row.owner_email }
      }))
    });
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
       WHERE i.public_token = ? AND i.public_expires_at > NOW()`,
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

  const shareMatch = pathname.match(/^\/api\/invitations\/([^/]+)\/([^/]+)\/share$/);
  if (request.method === "POST" && shareMatch) {
    const user = await requireUser(request, response);
    if (!user) return true;
    const [rows] = await database().execute(
      "SELECT * FROM invitations WHERE id = ? AND occasion = ? AND user_id = ?",
      [shareMatch[2], shareMatch[1], user.id]
    );
    const invitation = rows[0];
    if (!invitation) {
      sendJson(response, 404, { error: "Invitation not found" });
      return true;
    }
    if (invitation.public_generated_at) {
      sendJson(response, 402, {
        error: "A public link was already generated for this card. Please continue through payment.",
        paymentUrl: config.payment.placeholderPath
      });
      return true;
    }
    const fields = typeof invitation.fields === "string" ? JSON.parse(invitation.fields) : invitation.fields;
    const fingerprint = fingerprintFor(shareMatch[1], fields);
    const [duplicates] = await database().execute(
      `SELECT id FROM invitations
       WHERE user_id = ? AND occasion = ? AND public_fingerprint = ? AND public_generated_at IS NOT NULL AND id <> ?
       LIMIT 1`,
      [user.id, shareMatch[1], fingerprint, shareMatch[2]]
    );
    if (duplicates.length) {
      sendJson(response, 409, {
        error: "The same details were previously made public and you need to pay now",
        paymentUrl: config.payment.placeholderPath
      });
      return true;
    }
    const publicToken = crypto.randomUUID();
    await database().execute(
      `UPDATE invitations
       SET public_token = ?, public_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
           public_generated_at = COALESCE(public_generated_at, NOW()),
           public_fingerprint = ?, status = 'PUBLISHED'
       WHERE id = ? AND user_id = ?`,
      [publicToken, config.app.publicShareMinutes, fingerprint, shareMatch[2], user.id]
    );
    const [updated] = await database().execute("SELECT * FROM invitations WHERE id = ?", [shareMatch[2]]);
    sendJson(response, 200, invitationDto(updated[0]));
    return true;
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
        sendJson(response, 200, createOpenApi(host, port));
        return;
      }
      if (request.method === "GET" && pathname === "/api-docs") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(swaggerPage());
        return;
      }
      if (pathname.startsWith("/api/") && await handleApi(request, response, pathname)) return;
      if (request.method === "GET" && pageRoutes.has(pathname)) {
        serveHtmlTemplate(response, path.join(__dirname, "index.html"));
        return;
      }
      if (request.method === "GET" && pathname.startsWith(config.routing.shareRoutePrefix)) {
        serveHtmlTemplate(response, path.join(__dirname, "index.html"));
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

  server.listen(port, host, () => {
    console.log(`Invitation Studio ready at http://${host}:${port}`);
    console.log(`Swagger UI ready at http://${host}:${port}/api-docs`);
  });
}

start().catch((error) => {
  console.error("Unable to start Invitation Studio:", error.message);
  process.exitCode = 1;
});
