/**
 * Authentication APIs: registration, login/logout, email verification, and reset password.
 */
const crypto = require("crypto");
const { config } = require("../config");
const { database } = require("../database");
const {
  clearSessionCookie,
  createSession,
  currentUser,
  destroySession,
  hashPassword,
  sessionCookie,
  verifyPassword
} = require("../auth");
const { requireUser } = require("../middleware/auth-guards");
const { readJson, sendJson } = require("../utils/http");
const { tokenHash, userDto } = require("../utils/invitation-utils");
const { sendPasswordResetEmail, sendVerificationEmail } = require("../services/email-flows");

async function handleAuthApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/auth/me") {
    const user = await currentUser(request);
    sendJson(response, 200, { user: user ? userDto(user) : null });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/register") {
    const body = await readJson(request);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    if (!name || !email || password.length < 8) {
      sendJson(response, 400, {
        error: "Name, email, and a password of at least 8 characters are required."
      });
      return true;
    }
    const [existing] = await database().execute("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length) {
      sendJson(response, 409, { error: "An account with this email already exists." });
      return true;
    }
    const role = config.app.adminEmails.includes(email) ? "ADMIN" : "USER";
    const user = { id: crypto.randomUUID(), name, email, phone, role };
    await database().execute(
      "INSERT INTO users (id, name, email, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
      [user.id, name, email, phone || null, role, await hashPassword(password)]
    );
    try {
      await sendVerificationEmail(user);
    } catch (error) {
      console.warn("Verification email was not sent:", error.message);
    }
    const session = await createSession(user.id);
    sendJson(response, 201, { user: userDto({ ...user, email_verified_at: null }) }, {
      "Set-Cookie": sessionCookie(session.token, session.expiresAt)
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/verify-email/request") {
    const user = await requireUser(request, response);
    if (!user) return true;
    if (user.email_verified_at) {
      sendJson(response, 200, { message: "Email is already verified." });
      return true;
    }
    await sendVerificationEmail(user);
    sendJson(response, 200, { message: "Verification email sent." });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/verify-email") {
    const body = await readJson(request);
    const token = String(body.token || "").trim();
    if (!token) {
      sendJson(response, 400, { error: "Verification token is required." });
      return true;
    }
    const [rows] = await database().execute(
      `SELECT t.*, u.name, u.email AS current_email, u.phone, u.role
       FROM email_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? AND t.purpose = 'VERIFY_EMAIL' AND t.used_at IS NULL AND t.expires_at > NOW()`,
      [tokenHash(token)]
    );
    const record = rows[0];
    if (!record) {
      sendJson(response, 400, { error: "Verification link is invalid or expired." });
      return true;
    }
    await database().execute("UPDATE users SET email_verified_at = NOW() WHERE id = ? AND email = ?", [
      record.user_id,
      record.email
    ]);
    await database().execute("UPDATE email_tokens SET used_at = NOW() WHERE id = ?", [record.id]);
    sendJson(response, 200, {
      message: "Email verified successfully.",
      user: userDto({
        id: record.user_id,
        name: record.name,
        email: record.current_email,
        phone: record.phone,
        role: record.role,
        email_verified_at: new Date()
      })
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/forgot-password") {
    const body = await readJson(request);
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      sendJson(response, 400, { error: "Email is required." });
      return true;
    }
    const [rows] = await database().execute("SELECT id, name, email FROM users WHERE email = ?", [email]);
    if (rows[0]) {
      await sendPasswordResetEmail(rows[0]);
    }
    sendJson(response, 200, {
      message: "If an account exists for this email, a reset link has been sent."
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/reset-password") {
    const body = await readJson(request);
    const token = String(body.token || "").trim();
    const password = String(body.password || "");
    if (!token || password.length < 8) {
      sendJson(response, 400, { error: "A valid reset token and password of at least 8 characters are required." });
      return true;
    }
    const [rows] = await database().execute(
      `SELECT * FROM email_tokens
       WHERE token_hash = ? AND purpose = 'RESET_PASSWORD' AND used_at IS NULL AND expires_at > NOW()`,
      [tokenHash(token)]
    );
    const record = rows[0];
    if (!record) {
      sendJson(response, 400, { error: "Reset link is invalid or expired." });
      return true;
    }
    await database().execute("UPDATE users SET password_hash = ? WHERE id = ?", [
      await hashPassword(password),
      record.user_id
    ]);
    await database().execute("UPDATE email_tokens SET used_at = NOW() WHERE id = ?", [record.id]);
    await database().execute("DELETE FROM sessions WHERE user_id = ?", [record.user_id]);
    sendJson(response, 200, { message: "Password reset successfully. Please sign in again." });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    const body = await readJson(request);
    const email = String(body.email || "").trim().toLowerCase();
    const [rows] = await database().execute(
      "SELECT id, name, email, phone, role, password_hash FROM users WHERE email = ?",
      [email]
    );
    const account = rows[0];
    if (!account || !(await verifyPassword(String(body.password || ""), account.password_hash))) {
      sendJson(response, 401, { error: "Invalid email or password." });
      return true;
    }
    const session = await createSession(account.id);
    sendJson(response, 200, { user: userDto(account) }, {
      "Set-Cookie": sessionCookie(session.token, session.expiresAt)
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    await destroySession(request);
    sendJson(response, 200, { success: true }, { "Set-Cookie": clearSessionCookie() });
    return true;
  }

  return false;
}

module.exports = { handleAuthApi };
