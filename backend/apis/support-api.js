/** Customer feedback intake; admins review submissions through notifications. */
const crypto = require("crypto");
const { database } = require("../database");
const { currentUser } = require("../auth");
const { readJson, sendJson } = require("../utils/http");

async function handleSupportApi(request, response, pathname) {
  if (request.method !== "POST" || pathname !== "/api/contact") return false;
  const body = await readJson(request);
  const name = String(body.name || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 255);
  const phone = String(body.phone || "").trim().slice(0, 40);
  const category = String(body.category || "Feedback").trim().slice(0, 80);
  const subject = String(body.subject || "").trim().slice(0, 160);
  const message = String(body.message || "").trim().slice(0, 10000);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !subject || message.length < 5) {
    sendJson(response, 400, { error: "Enter your name, a valid email, subject, and message (at least 5 characters)." });
    return true;
  }
  const user = await currentUser(request);
  await database().execute(
    `INSERT INTO contact_submissions (id, user_id, name, email, phone, category, subject, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), user?.id || null, name, email, phone || null, category || "Feedback", subject, message]
  );
  sendJson(response, 201, { message: "Thank you. Your message has been sent to our team." });
  return true;
}

module.exports = { handleSupportApi };
