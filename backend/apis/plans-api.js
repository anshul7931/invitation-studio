/**
 * Plan, dummy payment, credit balance, and transaction APIs.
 */
const crypto = require("crypto");
const { database } = require("../database");
const { requireUser } = require("../middleware/auth-guards");
const { readJson, sendJson } = require("../utils/http");
const { catalogDto, periods, plans, priceFor } = require("../plans/catalog");

function planPurchaseDto(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    planTitle: row.plan_title,
    billingPeriod: row.billing_period,
    creditType: row.credit_type,
    totalCredits: row.total_credits,
    availableCredits: row.available_credits,
    amount: Number(row.amount),
    expiresAt: new Date(row.expires_at).toISOString(),
    daysLeft: Math.max(0, Math.ceil((new Date(row.expires_at).getTime() - Date.now()) / 86400000)),
    createdAt: new Date(row.created_at).toISOString()
  };
}

function transactionDto(row) {
  return {
    id: row.id,
    type: row.transaction_type,
    creditType: row.credit_type,
    credits: row.credits,
    amount: row.amount === null ? null : Number(row.amount),
    planTitle: row.plan_title || "",
    invitationTitle: row.invitation_title || "",
    note: row.note || "",
    createdAt: new Date(row.created_at).toISOString()
  };
}

async function handlePlansApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/plans") {
    sendJson(response, 200, catalogDto());
    return true;
  }

  if (request.method === "GET" && pathname === "/api/plans/me") {
    const user = await requireUser(request, response);
    if (!user) return true;
    const [purchases] = await database().execute(
      `SELECT * FROM plan_purchases
       WHERE user_id = ? AND expires_at > NOW() AND available_credits > 0
       ORDER BY expires_at ASC, created_at ASC`,
      [user.id]
    );
    const [transactions] = await database().execute(
      `SELECT t.*, p.plan_title, i.title AS invitation_title
       FROM credit_transactions t
       LEFT JOIN plan_purchases p ON p.id = t.purchase_id
       LEFT JOIN invitations i ON i.id = t.invitation_id
       WHERE t.user_id = ?
       ORDER BY t.created_at DESC
       LIMIT 30`,
      [user.id]
    );
    sendJson(response, 200, {
      purchases: purchases.map(planPurchaseDto),
      transactions: transactions.map(transactionDto)
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/plans/purchase") {
    const user = await requireUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    const plan = plans[body.planId];
    const period = periods[body.billingPeriod];
    const price = priceFor(body.planId, body.billingPeriod);
    const paidAmount = Number(body.amount);
    if (!plan || !period || !price) {
      sendJson(response, 400, { error: "Invalid plan selection." });
      return true;
    }
    if (paidAmount !== price.price) {
      sendJson(response, 400, { error: `Dummy payment amount must be ₹${price.price}.` });
      return true;
    }
    const purchaseId = crypto.randomUUID();
    await database().execute(
      `INSERT INTO plan_purchases
       (id, user_id, plan_id, plan_title, billing_period, credit_type, total_credits, available_credits, amount, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
      [purchaseId, user.id, plan.id, plan.title, body.billingPeriod, plan.creditType, plan.credits, plan.credits, price.price, period.days]
    );
    await database().execute(
      `INSERT INTO credit_transactions
       (id, user_id, purchase_id, transaction_type, credit_type, credits, amount, note)
       VALUES (?, ?, ?, 'PURCHASE', ?, ?, ?, ?)`,
      [crypto.randomUUID(), user.id, purchaseId, plan.creditType, plan.credits, price.price, `${plan.title} · ${period.label}`]
    );
    const [rows] = await database().execute("SELECT * FROM plan_purchases WHERE id = ?", [purchaseId]);
    sendJson(response, 201, { purchase: planPurchaseDto(rows[0]) });
    return true;
  }

  return false;
}

module.exports = { handlePlansApi };
