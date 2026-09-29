/**
 * Admin APIs for application-wide user and invitation visibility.
 */
const { config } = require("../config");
const { database } = require("../database");
const { requireAdmin } = require("../middleware/auth-guards");
const { sendJson } = require("../utils/http");
const { invitationDto } = require("../utils/invitation-utils");
const { recentIssues } = require("../utils/monitoring");
const { sendPasswordResetEmail } = require("../services/email-flows");

function pageParams(url) {
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page"), 10) || 1);
  const pageSize = Math.min(50, Math.max(5, Number.parseInt(url.searchParams.get("pageSize"), 10) || 10));
  return { page, pageSize, offset: (page - 1) * pageSize, q: (url.searchParams.get("q") || "").trim().slice(0, 120) };
}

async function handleAdminApi(request, response, pathname) {
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
    const params = pageParams(new URL(request.url, `http://${config.app.host}:${config.app.port}`));
    const pattern = `%${params.q}%`;
    const userWhere = params.q ? "WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?" : "";
    const searchValues = params.q ? [pattern, pattern, pattern] : [];
    const [[{ total }]] = await database().execute(`SELECT COUNT(*) AS total FROM users ${userWhere}`, searchValues);
    const [rows] = await database().execute(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at, COUNT(i.id) AS invitation_count
       FROM users u LEFT JOIN invitations i ON i.user_id = u.id
       ${params.q ? "WHERE u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?" : ""}
       GROUP BY u.id ORDER BY u.created_at DESC LIMIT ${params.pageSize} OFFSET ${params.offset}`,
      searchValues
    );
    sendJson(response, 200, { users: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone || "",
      role: row.role,
      invitationCount: row.invitation_count,
      createdAt: new Date(row.created_at).toISOString()
    })), total, page: params.page, pageSize: params.pageSize });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/admin/invitations") {
    const admin = await requireAdmin(request, response);
    if (!admin) return true;
    const url = new URL(request.url, `http://${config.app.host}:${config.app.port}`);
    const params = pageParams(url);
    const userId = url.searchParams.get("userId");
    const pattern = `%${params.q}%`;
    const conditions = [];
    const values = [];
    if (params.q) {
      conditions.push("(i.title LIKE ? OR i.occasion LIKE ? OR u.name LIKE ? OR u.email LIKE ?)");
      values.push(pattern, pattern, pattern, pattern);
    }
    if (userId) {
      conditions.push("i.user_id = ?");
      values.push(userId);
    }
    const filters = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [[{ total }]] = await database().execute(
      `SELECT COUNT(*) AS total FROM invitations i JOIN users u ON u.id = i.user_id ${filters}`,
      values
    );
    const [rows] = await database().execute(
      `SELECT i.*, u.name AS owner_name, u.email AS owner_email
       FROM invitations i JOIN users u ON u.id = i.user_id ${filters}
       ORDER BY i.updated_at DESC LIMIT ${params.pageSize} OFFSET ${params.offset}`,
      values
    );
    sendJson(response, 200, {
      invitations: rows.map((row) => ({
        ...invitationDto(row),
        owner: { name: row.owner_name, email: row.owner_email }
      })),
      total, page: params.page, pageSize: params.pageSize
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/admin/logs") {
    const admin = await requireAdmin(request, response);
    if (!admin) return true;
    sendJson(response, 200, { logs: recentIssues() });
    return true;
  }

  if (request.method === "POST" && /^\/api\/admin\/users\/[^/]+\/reset-password$/.test(pathname)) {
    const admin = await requireAdmin(request, response);
    if (!admin) return true;
    const userId = pathname.split("/")[4];
    const [users] = await database().execute("SELECT id, name, email FROM users WHERE id = ?", [userId]);
    if (!users[0]) {
      sendJson(response, 404, { error: "User not found." });
      return true;
    }
    const result = await sendPasswordResetEmail(users[0]);
    sendJson(response, 200, { message: result.skipped ? "Reset email was not sent because email delivery is disabled." : `Password reset email sent to ${users[0].email}.` });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/admin/notifications") {
    const admin = await requireAdmin(request, response);
    if (!admin) return true;
    const entries = recentIssues().map((issue) => ({
        id: `error:${issue.id}`, type: "Error", user: issue.user || { name: "Unattributed error", email: "" },
        createdAt: issue.createdAt, summary: issue.message,
        details: { level: issue.level, path: issue.path, message: issue.message, stack: issue.stack }
      })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    sendJson(response, 200, { notifications: entries });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/admin/feedback") {
    const admin = await requireAdmin(request, response);
    if (!admin) return true;
    const [rows] = await database().query(
      `SELECT id, name, email, phone, category, subject, message, created_at
       FROM contact_submissions ORDER BY created_at DESC LIMIT 500`
    );
    const feedback = rows.map((item) => ({
      id: item.id, type: "Feedback", user: { name: item.name, email: item.email },
      createdAt: new Date(item.created_at).toISOString(), summary: item.subject,
      details: { category: item.category, phone: item.phone || "", message: item.message }
    }));
    sendJson(response, 200, { feedback });
    return true;
  }

  return false;
}

module.exports = { handleAdminApi };
