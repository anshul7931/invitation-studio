/**
 * Profile APIs for the signed-in user.
 */
const { database } = require("../database");
const { requireUser } = require("../middleware/auth-guards");
const { readJson, sendJson } = require("../utils/http");
const { userDto } = require("../utils/invitation-utils");
const { isValidPhone } = require("../utils/validation");
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
    if (!phone || !isValidPhone(phone)) {
      sendJson(response, 400, { error: "Enter exactly 10 digits for phone number." });
      return true;
    }
    const [existing] = await database().execute(
      "SELECT id, email FROM users WHERE (email = ? OR phone = ?) AND id <> ? LIMIT 1",
      [email, phone, user.id]
    );
    if (existing.length) {
      sendJson(response, 409, { error: existing[0].email === email
        ? "Another account already uses this email."
        : "Another account already uses this phone number." });
      return true;
    }
    const emailChanged = email !== user.email;
    try {
      await database().execute("UPDATE users SET name = ?, email = ?, phone = ?, email_verified_at = ?, role = ? WHERE id = ?", [
        name, email, phone, emailChanged ? null : user.email_verified_at,
        emailChanged ? "USER" : user.role, user.id
      ]);
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        sendJson(response, 409, { error: "Another account already uses this email or phone number." });
        return true;
      }
      throw error;
    }
    const updatedUser = { ...user, name, email, phone, role: emailChanged ? "USER" : user.role, email_verified_at: emailChanged ? null : user.email_verified_at };
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
