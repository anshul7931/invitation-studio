/**
 * Signed-in invitation CRUD APIs.
 */
const crypto = require("crypto");
const { database } = require("../database");
const { occasions } = require("../occasion-schema");
const { requireUser } = require("../middleware/auth-guards");
const { readJson, sendJson } = require("../utils/http");
const { invitationDto, invitationTitle } = require("../utils/invitation-utils");

async function handleInvitationApi(request, response, pathname) {
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
      const fields = {
        ...(typeof rows[0].fields === "string" ? JSON.parse(rows[0].fields) : rows[0].fields),
        ...(await readJson(request))
      };
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

module.exports = { handleInvitationApi };
