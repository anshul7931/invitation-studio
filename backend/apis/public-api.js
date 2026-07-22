/**
 * Public sharing APIs for read-only invitation links and link generation.
 */
const crypto = require("crypto");
const { config } = require("../config");
const { database } = require("../database");
const { requireUser } = require("../middleware/auth-guards");
const { sendJson } = require("../utils/http");
const { fingerprintFor, invitationDto } = require("../utils/invitation-utils");

async function handlePublicApi(request, response, pathname) {
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
    const invitation = invitationDto(rows[0]);
    if (invitation.publicExpiresAt && new Date(invitation.publicExpiresAt).getTime() <= Date.now()) {
      sendJson(response, 404, { error: "Shared invitation not found" });
      return true;
    }
    sendJson(response, 200, { ...invitation, owner: rows[0].owner_name, readOnly: true });
    return true;
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
    const hasPremiumPhotos = String(fields.photoLinks || "").trim().length > 0;
    const freeMinutes = fields.templateType === "premium" || hasPremiumPhotos ? 5 : config.app.publicShareMinutes;
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
      [publicToken, freeMinutes, fingerprint, shareMatch[2], user.id]
    );
    const [updated] = await database().execute("SELECT * FROM invitations WHERE id = ?", [shareMatch[2]]);
    sendJson(response, 200, invitationDto(updated[0]));
    return true;
  }

  return false;
}

module.exports = { handlePublicApi };
