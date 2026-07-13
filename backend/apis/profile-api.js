/**
 * Profile APIs for the signed-in user.
 */
const { database } = require("../database");
const { requireUser } = require("../middleware/auth-guards");
const { readJson, sendJson } = require("../utils/http");
const { userDto } = require("../utils/invitation-utils");
const { sendVerificationEmail } = require("../services/email-flows");

async function handleProfileApi(request, response, pathname) {
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

  return false;
}

module.exports = { handleProfileApi };
