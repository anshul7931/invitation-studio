/**
 * Email workflows for verification and password reset.
 * Provider-specific delivery stays inside email/service.js.
 */
const crypto = require("crypto");
const { config } = require("../config");
const { database } = require("../database");
const { sendTransactionalEmail } = require("../email/service");
const { tokenHash } = require("../utils/invitation-utils");
const { escapeHtml } = require("../utils/text");

async function createEmailToken(userId, email, purpose, expiryMinutes) {
  const token = crypto.randomBytes(32).toString("base64url");
  await database().execute(
    `UPDATE email_tokens
     SET used_at = NOW()
     WHERE user_id = ? AND purpose = ? AND used_at IS NULL`,
    [userId, purpose]
  );
  await database().execute(
    `INSERT INTO email_tokens (id, user_id, email, purpose, token_hash, expires_at)
     VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [crypto.randomUUID(), userId, email, purpose, tokenHash(token), expiryMinutes]
  );
  return token;
}

async function markEmailTokenProviderMessage(token, providerMessageId) {
  if (!providerMessageId) return;
  await database().execute(
    "UPDATE email_tokens SET provider_message_id = ? WHERE token_hash = ?",
    [providerMessageId, tokenHash(token)]
  );
}

async function sendVerificationEmail(user) {
  const token = await createEmailToken(user.id, user.email, "VERIFY_EMAIL", config.email.verifyTokenMinutes);
  const verifyUrl = `${config.app.publicUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const result = await sendTransactionalEmail("VERIFY_EMAIL", {
    to: user.email,
    subject: "Verify your Invitation Studio email",
    html: `
      <p>Hello ${escapeHtml(user.name)},</p>
      <p>Please verify your email address for Invitation Studio.</p>
      <p><a href="${verifyUrl}">Verify email</a></p>
      <p>This link expires in ${config.email.verifyTokenMinutes} minutes.</p>
    `,
    text: `Hello ${user.name}, verify your Invitation Studio email: ${verifyUrl}`,
    idempotencyKey: `verify-${user.id}-${Date.now()}`
  });
  await markEmailTokenProviderMessage(token, result.messageId);
  return result;
}

async function sendPasswordResetEmail(user) {
  const token = await createEmailToken(user.id, user.email, "RESET_PASSWORD", config.email.resetTokenMinutes);
  const resetUrl = `${config.app.publicUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const result = await sendTransactionalEmail("RESET_PASSWORD", {
    to: user.email,
    subject: "Reset your Invitation Studio password",
    html: `
      <p>Hello ${escapeHtml(user.name)},</p>
      <p>Use the link below to reset your Invitation Studio password.</p>
      <p><a href="${resetUrl}">Reset password</a></p>
      <p>This link expires in ${config.email.resetTokenMinutes} minutes.</p>
    `,
    text: `Hello ${user.name}, reset your Invitation Studio password: ${resetUrl}`,
    idempotencyKey: `reset-${user.id}-${Date.now()}`
  });
  await markEmailTokenProviderMessage(token, result.messageId);
  return result;
}

module.exports = {
  sendPasswordResetEmail,
  sendVerificationEmail
};
