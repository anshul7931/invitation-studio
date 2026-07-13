const https = require("https");
const { URL } = require("url");
const { config } = require("../../config");

function requestJson(url, options, payload) {
  const target = new URL(url);
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        method: options.method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...options.headers
        }
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          const parsed = data ? JSON.parse(data) : {};
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(parsed);
            return;
          }
          reject(new Error(parsed.message || parsed.error || `Resend request failed with status ${response.statusCode}`));
        });
      }
    );

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

async function sendEmail(message) {
  const { apiKey, apiUrl } = config.email.providers.resend;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const payload = {
    from: message.from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text
  };
  if (message.replyTo) payload.reply_to = message.replyTo;

  const data = await requestJson(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {})
    }
  }, payload);

  return {
    provider: "resend",
    messageId: data.id || ""
  };
}

module.exports = { sendEmail };
