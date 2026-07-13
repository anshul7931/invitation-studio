/**
 * Admin APIs for application-wide user and invitation visibility.
 */
const { config } = require("../config");
const { database } = require("../database");
const { requireAdmin } = require("../middleware/auth-guards");
const { sendJson } = require("../utils/http");
const { invitationDto } = require("../utils/invitation-utils");

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
    const userId = new URL(request.url, `http://${config.app.host}:${config.app.port}`).searchParams.get("userId");
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

  return false;
}

module.exports = { handleAdminApi };
