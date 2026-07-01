/**
 * Authentication helpers for secure password storage and cookie-based sessions.
 */
const crypto = require("crypto");
const { promisify } = require("util");
const { database } = require("./database");
const { config } = require("./config");

const scrypt = promisify(crypto.scrypt);
const sessionDurationMs = config.session.days * 24 * 60 * 60 * 1000;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  const [salt, storedKey] = storedHash.split(":");
  if (!salt || !storedKey) return false;
  const derived = await scrypt(password, salt, 64);
  const expected = Buffer.from(storedKey, "hex");
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf("=");
        return [cookie.slice(0, index), decodeURIComponent(cookie.slice(index + 1))];
      })
  );
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  await database().execute(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
    [tokenHash(token), userId, expiresAt]
  );
  return { token, expiresAt };
}

async function currentUser(request) {
  const token = parseCookies(request)[config.session.cookieName];
  if (!token) return null;
  const [rows] = await database().execute(
    `SELECT u.id, u.name, u.email, u.phone, u.role
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > NOW()`,
    [tokenHash(token)]
  );
  return rows[0] || null;
}

async function destroySession(request) {
  const token = parseCookies(request)[config.session.cookieName];
  if (token) {
    await database().execute("DELETE FROM sessions WHERE token_hash = ?", [tokenHash(token)]);
  }
}

function sessionCookie(token, expiresAt) {
  return `${config.session.cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}`;
}

function clearSessionCookie() {
  return `${config.session.cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  currentUser,
  destroySession,
  sessionCookie,
  clearSessionCookie
};
