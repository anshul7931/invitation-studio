/**
 * Signed-in invitation CRUD APIs.
 */
const crypto = require("crypto");
const { database } = require("../database");
const { occasions } = require("../occasion-schema");
const { requireUser } = require("../middleware/auth-guards");
const { readJson, sendJson } = require("../utils/http");
const { invitationDto, invitationTitle } = require("../utils/invitation-utils");

function effectiveLinkStatus(link) {
  if (link.public_expires_at && new Date(link.public_expires_at).getTime() <= Date.now()) return "EXPIRED";
  return link.status;
}

function linkDto(link) {
  const expiredAt = link.public_expires_at ? new Date(link.public_expires_at) : null;
  return {
    shareUrl: link.public_token ? `/share/${link.public_token}` : null,
    publicExpiresAt: expiredAt ? expiredAt.toISOString() : null,
    publicGeneratedAt: link.public_generated_at ? new Date(link.public_generated_at).toISOString() : null,
    status: effectiveLinkStatus(link),
    templateType: link.template_type,
    planTitle: link.plan_title || "",
    creditType: link.credit_type || "",
    billingPeriod: link.billing_period || "",
    daysUntilPermanentDelete: expiredAt && expiredAt.getTime() <= Date.now()
      ? Math.max(0, 365 - Math.floor((Date.now() - expiredAt.getTime()) / 86400000))
      : null
  };
}

async function maintainInvitationLifecycle(userId) {
  await database().execute(
    "UPDATE invitation_public_links SET status = 'EXPIRED' WHERE user_id = ? AND status IN ('PUBLISHED', 'PAID') AND public_expires_at <= NOW()",
    [userId]
  );
  await database().execute(
    `UPDATE invitations i
     SET i.status = 'EXPIRED'
     WHERE i.user_id = ? AND i.status IN ('PUBLISHED', 'PAID')
       AND EXISTS (SELECT 1 FROM invitation_public_links l WHERE l.invitation_id = i.id AND l.status = 'EXPIRED')
       AND NOT EXISTS (SELECT 1 FROM invitation_public_links l WHERE l.invitation_id = i.id AND l.public_expires_at > NOW())`,
    [userId]
  );
  await database().execute(
    `DELETE i FROM invitations i
     WHERE i.user_id = ? AND i.status = 'EXPIRED'
       AND EXISTS (
         SELECT 1 FROM invitation_public_links l
         WHERE l.invitation_id = i.id
           AND l.public_expires_at <= DATE_SUB(NOW(), INTERVAL 365 DAY)
       )`,
    [userId]
  );
}

async function attachShareSummaries(invitations) {
  if (!invitations.length) return invitations;
  const ids = invitations.map((invitation) => invitation.id);
  const [links] = await database().query(
    `SELECT l.*, p.plan_title, p.credit_type, p.billing_period
     FROM invitation_public_links l
     LEFT JOIN plan_purchases p ON p.id = l.purchase_id
     WHERE l.invitation_id IN (?)
     ORDER BY l.public_expires_at DESC`,
    [ids]
  );
  const byInvitation = new Map();
  links.forEach((link) => {
    if (!byInvitation.has(link.invitation_id)) byInvitation.set(link.invitation_id, []);
    byInvitation.get(link.invitation_id).push(link);
  });
  return invitations.map((invitation) => {
    const relatedLinks = byInvitation.get(invitation.id) || [];
    const linkDtos = relatedLinks.map(linkDto);
    invitation.shareStates = Object.fromEntries(linkDtos.map((link) => [link.templateType, link]));
    const activePaid = linkDtos.find((link) => link.status === "PAID");
    const activePublished = linkDtos.find((link) => link.status === "PUBLISHED");
    const expired = linkDtos.find((link) => link.status === "EXPIRED");
    if (invitation.status === "PAID" && activePaid) {
      Object.assign(invitation, {
        paidPlanTitle: activePaid.planTitle || `${activePaid.creditType || "Paid"} plan`,
        paidCreditType: activePaid.creditType,
        paidBillingPeriod: activePaid.billingPeriod,
        publicExpiresAt: activePaid.publicExpiresAt,
        status: "PAID"
      });
    } else if (["PUBLISHED", "PAID", "EXPIRED"].includes(invitation.status) && expired && !activePaid && !activePublished) {
      Object.assign(invitation, {
        status: "EXPIRED",
        publicExpiresAt: expired.publicExpiresAt,
        daysUntilPermanentDelete: expired.daysUntilPermanentDelete
      });
    } else if (invitation.status === "PUBLISHED" && activePublished) {
      Object.assign(invitation, {
        publicExpiresAt: activePublished.publicExpiresAt,
        status: "PUBLISHED"
      });
    }
    return invitation;
  });
}

async function handleInvitationApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/invitations") {
    const user = await requireUser(request, response);
    if (!user) return true;
    await maintainInvitationLifecycle(user.id);
    const [rows] = await database().execute(
      "SELECT * FROM invitations WHERE user_id = ? ORDER BY created_at DESC",
      [user.id]
    );
    const invitations = await attachShareSummaries(rows.map(invitationDto));
    sendJson(response, 200, { invitations });
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
    const body = await readJson(request);
    const isDraft = body.__draft === true;
    delete body.__draft;
    const fields = { ...config.defaults, ...body };
    const missing = config.required.filter((name) => !String(fields[name] || "").trim());
    if (missing.length) {
      sendJson(response, 400, { error: "Missing required fields", fields: missing });
      return true;
    }
    const id = crypto.randomUUID();
    await database().execute(
      "INSERT INTO invitations (id, user_id, share_token, occasion, title, fields, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, user.id, crypto.randomUUID(), occasion, invitationTitle(occasion, fields), JSON.stringify(fields), isDraft ? "DRAFT" : "SAVED"]
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
        "UPDATE invitations SET title = ?, fields = ?, status = 'SAVED' WHERE id = ? AND user_id = ?",
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
