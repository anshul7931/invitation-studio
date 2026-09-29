/**
 * Public sharing APIs for read-only invitation links and link generation.
 */
const crypto = require("crypto");
const { config } = require("../config");
const { database } = require("../database");
const { requireUser } = require("../middleware/auth-guards");
const { readJson, sendJson } = require("../utils/http");
const { fingerprintFor, invitationDto, publicLinkUrl } = require("../utils/invitation-utils");
const { periods } = require("../plans/catalog");

function templateTypeFromFields(fields, requestedTemplate) {
  if (requestedTemplate === "premium") return "premium";
  if (requestedTemplate === "basic") return "basic";
  return fields.templateType === "premium" || String(fields.photoLinks || "").trim() || String(fields.publicHashtag || "").trim() ? "premium" : "basic";
}

function publicLinkStatus(link) {
  if (link.public_expires_at && new Date(link.public_expires_at).getTime() <= Date.now()) return "EXPIRED";
  return link.status;
}

function hashtagSlug(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/^#+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

async function choosePublicPath(hashtag, existingLink) {
  if (!hashtag) return existingLink?.public_path || null;
  const previousSlug = existingLink?.public_path?.split("/").slice(1).join("/");
  if (previousSlug === hashtag) return existingLink.public_path;
  for (let sequence = 1; sequence < 100000; sequence += 1) {
    const candidate = `${sequence}/${hashtag}`;
    const [matches] = await database().execute(
      "SELECT id FROM invitation_public_links WHERE public_path = ? LIMIT 1", [candidate]
    );
    if (!matches.length) return candidate;
  }
  throw new Error("Could not allocate a unique invitation link.");
}

async function consumeCredit({ userId, invitation, templateType, purchaseId = "" }) {
  const allowedTypes = templateType === "premium" ? ["PREMIUM"] : ["BASIC", "PREMIUM"];
  if (purchaseId) {
    const [selected] = await database().execute(
      `SELECT * FROM plan_purchases
       WHERE id = ? AND user_id = ? AND credit_type IN (${allowedTypes.map(() => "?").join(",")})
         AND available_credits > 0 AND expires_at > NOW()
       LIMIT 1`,
      [purchaseId, userId, ...allowedTypes]
    );
    if (selected[0]) {
      const purchase = selected[0];
      await database().execute(
        "UPDATE plan_purchases SET available_credits = available_credits - 1 WHERE id = ? AND available_credits > 0",
        [purchase.id]
      );
      await database().execute(
        `INSERT INTO credit_transactions
         (id, user_id, purchase_id, invitation_id, transaction_type, credit_type, credits, note)
         VALUES (?, ?, ?, ?, 'CREDIT_USED', ?, -1, ?)`,
        [crypto.randomUUID(), userId, purchase.id, invitation.id, purchase.credit_type, `Public link generated for ${invitation.title}`]
      );
      return purchase;
    }
  }
  for (const creditType of allowedTypes) {
    const [purchases] = await database().execute(
      `SELECT * FROM plan_purchases
       WHERE user_id = ? AND credit_type = ? AND available_credits > 0 AND expires_at > NOW()
       ORDER BY expires_at ASC, created_at ASC
       LIMIT 1`,
      [userId, creditType]
    );
    const purchase = purchases[0];
    if (!purchase) continue;
    await database().execute(
      "UPDATE plan_purchases SET available_credits = available_credits - 1 WHERE id = ? AND available_credits > 0",
      [purchase.id]
    );
    await database().execute(
      `INSERT INTO credit_transactions
       (id, user_id, purchase_id, invitation_id, transaction_type, credit_type, credits, note)
       VALUES (?, ?, ?, ?, 'CREDIT_USED', ?, -1, ?)`,
      [crypto.randomUUID(), userId, purchase.id, invitation.id, creditType, `Public link generated for ${invitation.title}`]
    );
    return purchase;
  }
  return null;
}

async function handlePublicApi(request, response, pathname) {
  const stateMatch = pathname.match(/^\/api\/invitations\/([^/]+)\/([^/]+)\/share-states$/);
  if (request.method === "GET" && stateMatch) {
    const user = await requireUser(request, response);
    if (!user) return true;
    const [owned] = await database().execute(
      "SELECT id, fields FROM invitations WHERE id = ? AND occasion = ? AND user_id = ?",
      [stateMatch[2], stateMatch[1], user.id]
    );
    if (!owned[0]) {
      sendJson(response, 404, { error: "Invitation not found" });
      return true;
    }
    const [links] = await database().execute(
      "SELECT * FROM invitation_public_links WHERE invitation_id = ?",
      [stateMatch[2]]
    );
    const invitationFields = typeof owned[0].fields === "string" ? JSON.parse(owned[0].fields) : owned[0].fields;
    for (const link of links) {
      if (link.template_type !== "premium" || link.public_path) continue;
      const slug = hashtagSlug(invitationFields.publicHashtag);
      if (!slug) continue;
      link.public_path = await choosePublicPath(slug, link);
      await database().execute("UPDATE invitation_public_links SET public_path = ? WHERE id = ? AND public_path IS NULL", [link.public_path, link.id]);
    }
    sendJson(response, 200, {
      shareStates: Object.fromEntries(links.map((link) => [link.template_type, {
        shareUrl: publicLinkUrl(link),
        publicExpiresAt: link.public_expires_at ? new Date(link.public_expires_at).toISOString() : null,
        status: publicLinkStatus(link)
      }]))
    });
    return true;
  }

  const publicMatch = pathname.match(/^\/api\/public\/([^/]+)$/);
  const customPathMatch = pathname.match(/^\/api\/public-path\/(\d+)\/([a-z0-9-]+)$/i);
  if (request.method === "GET" && (publicMatch || customPathMatch)) {
    const condition = customPathMatch ? "l.public_path = ?" : "l.public_token = ?";
    const lookup = customPathMatch ? `${customPathMatch[1]}/${customPathMatch[2]}` : publicMatch[1];
    const [rows] = await database().execute(
      `SELECT i.*, l.template_type, l.public_token, l.public_path, l.public_expires_at, l.public_generated_at,
              l.status AS link_status, u.name AS owner_name
       FROM invitation_public_links l
       JOIN invitations i ON i.id = l.invitation_id
       JOIN users u ON u.id = i.user_id
       WHERE ${condition} AND l.public_expires_at > NOW()`,
      [lookup]
    );
    if (!rows[0]) {
      sendJson(response, 404, { error: "Shared invitation not found" });
      return true;
    }
    rows[0].status = rows[0].link_status;
    const invitation = invitationDto(rows[0]);
    invitation.fields.templateType = rows[0].template_type;
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
    const body = await readJson(request);
    const [rows] = await database().execute(
      "SELECT * FROM invitations WHERE id = ? AND occasion = ? AND user_id = ?",
      [shareMatch[2], shareMatch[1], user.id]
    );
    const invitation = rows[0];
    if (!invitation) {
      sendJson(response, 404, { error: "Invitation not found" });
      return true;
    }
    const fields = typeof invitation.fields === "string" ? JSON.parse(invitation.fields) : invitation.fields;
    const templateType = templateTypeFromFields(fields, body.templateType);
    const shareFields = { ...fields, templateType };
    const freeMinutes = templateType === "premium" ? 5 : config.app.publicShareMinutes;
    const fingerprint = fingerprintFor(shareMatch[1], shareFields);
    const [existingLinks] = await database().execute(
      "SELECT * FROM invitation_public_links WHERE invitation_id = ? AND template_type = ?",
      [shareMatch[2], templateType]
    );
    const existingLink = existingLinks[0];
    const [duplicates] = await database().execute(
      `SELECT l.id FROM invitation_public_links l
       JOIN invitations i ON i.id = l.invitation_id
       WHERE l.user_id = ? AND i.occasion = ? AND l.template_type = ?
         AND l.public_fingerprint = ? AND l.public_generated_at IS NOT NULL AND l.invitation_id <> ?
      LIMIT 1`,
      [user.id, shareMatch[1], templateType, fingerprint, shareMatch[2]]
    );
    const requestedPaidLink = body.useCredit === true;
    const blockedFreeLink = Boolean(existingLink?.public_generated_at || duplicates.length);
    if (blockedFreeLink && !requestedPaidLink) {
      sendJson(response, existingLink?.public_generated_at ? 402 : 409, {
        error: existingLink?.public_generated_at
          ? "A public link was already generated for this card. Please continue through payment."
          : "The same details were previously made public and you need to buy credits now",
        paymentUrl: config.payment.placeholderPath
      });
      return true;
    }
    const needsPaidCredit = requestedPaidLink;
    let paidPurchase = null;
    if (needsPaidCredit) {
      paidPurchase = await consumeCredit({ userId: user.id, invitation, templateType, purchaseId: String(body.purchaseId || "") });
      if (!paidPurchase) {
        sendJson(response, existingLink?.public_generated_at ? 402 : 409, {
          error: existingLink?.public_generated_at
            ? "A public link was already generated for this card. Please continue through payment."
            : "The same details were previously made public and you need to buy credits now",
          paymentUrl: config.payment.placeholderPath
        });
        return true;
      }
    }
    const publicToken = crypto.randomUUID();
    const linkId = existingLink?.id || crypto.randomUUID();
    const publicPath = templateType === "premium"
      ? await choosePublicPath(hashtagSlug(body.publicHashtag || fields.publicHashtag), existingLink)
      : null;
    if (paidPurchase) {
      await database().execute(
        `INSERT INTO invitation_public_links
         (id, invitation_id, user_id, template_type, public_token, public_path, public_expires_at, public_generated_at, public_fingerprint, purchase_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, 'PAID')
         ON DUPLICATE KEY UPDATE public_token = VALUES(public_token), public_path = VALUES(public_path), public_expires_at = VALUES(public_expires_at),
           public_generated_at = COALESCE(public_generated_at, NOW()), public_fingerprint = VALUES(public_fingerprint),
           purchase_id = VALUES(purchase_id), status = 'PAID'`,
        [linkId, shareMatch[2], user.id, templateType, publicToken, publicPath, new Date(Date.now() + periods[paidPurchase.billing_period].days * 86400000), fingerprint, paidPurchase.id]
      );
      await database().execute("UPDATE invitations SET status = 'PAID' WHERE id = ? AND user_id = ?", [shareMatch[2], user.id]);
    } else {
      await database().execute(
        `INSERT INTO invitation_public_links
         (id, invitation_id, user_id, template_type, public_token, public_path, public_expires_at, public_generated_at, public_fingerprint, status)
         VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW(), ?, 'PUBLISHED')
         ON DUPLICATE KEY UPDATE public_token = VALUES(public_token), public_path = VALUES(public_path), public_expires_at = VALUES(public_expires_at),
           public_generated_at = COALESCE(public_generated_at, NOW()), public_fingerprint = VALUES(public_fingerprint), status = 'PUBLISHED'`,
        [linkId, shareMatch[2], user.id, templateType, publicToken, publicPath, freeMinutes, fingerprint]
      );
      await database().execute("UPDATE invitations SET status = 'PUBLISHED' WHERE id = ? AND user_id = ?", [shareMatch[2], user.id]);
    }
    const [updated] = await database().execute("SELECT * FROM invitations WHERE id = ?", [shareMatch[2]]);
    const dto = invitationDto(updated[0]);
    const [links] = await database().execute("SELECT * FROM invitation_public_links WHERE invitation_id = ?", [shareMatch[2]]);
    dto.shareStates = Object.fromEntries(links.map((link) => [link.template_type, {
      shareUrl: publicLinkUrl(link),
      publicExpiresAt: link.public_expires_at ? new Date(link.public_expires_at).toISOString() : null,
      status: publicLinkStatus(link)
    }]));
    dto.shareUrl = dto.shareStates[templateType]?.shareUrl || null;
    dto.publicExpiresAt = dto.shareStates[templateType]?.publicExpiresAt || null;
    dto.status = dto.shareStates[templateType]?.status || dto.status;
    sendJson(response, 200, dto);
    return true;
  }

  return false;
}

module.exports = { handlePublicApi };
