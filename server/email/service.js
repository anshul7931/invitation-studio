const crypto = require("crypto");
const { config } = require("../config");
const { database } = require("../database");
const resend = require("./providers/resend");

const providers = {
  resend
};

function providerForPurpose(purpose) {
  if (purpose === "RESET_PASSWORD") return config.email.resetProvider;
  if (purpose === "VERIFY_EMAIL") return config.email.verifyProvider;
  return config.email.defaultProvider;
}

async function assertWithinEmailRateLimit() {
  const [[perSecond]] = await database().query(
    "SELECT COUNT(*) AS count FROM email_send_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 SECOND)"
  );
  if (perSecond.count >= config.email.rateLimitPerSecond) {
    throw new Error("Email rate limit reached. Please try again shortly.");
  }

  const [[perDay]] = await database().query(
    "SELECT COUNT(*) AS count FROM email_send_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)"
  );
  if (perDay.count >= config.email.rateLimitPerDay) {
    throw new Error("Daily email limit reached. Please try again tomorrow.");
  }
}

async function logEmailSend({ provider, purpose, recipient, status, providerMessageId = "", errorMessage = "" }) {
  await database().execute(
    `INSERT INTO email_send_logs
       (id, provider, purpose, recipient, status, provider_message_id, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      provider,
      purpose,
      recipient,
      status,
      providerMessageId || null,
      errorMessage ? errorMessage.slice(0, 500) : null
    ]
  );
}

async function sendTransactionalEmail(purpose, message) {
  const providerName = providerForPurpose(purpose);
  const provider = providers[providerName];
  if (!provider) throw new Error(`Email provider '${providerName}' is not supported.`);

  if (!config.email.enabled) {
    await logEmailSend({
      provider: providerName,
      purpose,
      recipient: message.to,
      status: "SKIPPED",
      errorMessage: "Email sending is disabled."
    });
    return { skipped: true, provider: providerName, messageId: "" };
  }

  await assertWithinEmailRateLimit();

  try {
    const result = await provider.sendEmail({
      from: config.email.from,
      replyTo: config.email.replyTo,
      ...message
    });
    await logEmailSend({
      provider: providerName,
      purpose,
      recipient: message.to,
      status: "SENT",
      providerMessageId: result.messageId
    });
    return result;
  } catch (error) {
    await logEmailSend({
      provider: providerName,
      purpose,
      recipient: message.to,
      status: "FAILED",
      errorMessage: error.message
    });
    throw error;
  }
}

module.exports = { sendTransactionalEmail };
