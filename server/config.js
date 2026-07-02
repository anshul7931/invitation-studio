/**
 * Central application configuration.
 * Environment variables override these defaults; README documents each option.
 */
const { loadLocalEnv } = require("./env-loader");

loadLocalEnv();

const config = {
  app: {
    name: process.env.APP_NAME || "Invitation Studio",
    host: process.env.HOST || "127.0.0.1",
    port: Number(process.env.PORT) || 3000,
    publicUrl: process.env.PUBLIC_APP_URL || `http://${process.env.HOST || "127.0.0.1"}:${Number(process.env.PORT) || 3000}`,
    publicShareMinutes: Number(process.env.PUBLIC_SHARE_MINUTES) || 10,
    adminEmails: (process.env.ADMIN_EMAILS || "admin@invitation.local")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  },
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "root",
    name: process.env.DB_NAME || "invitation_factory",
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10
  },
  session: {
    cookieName: process.env.SESSION_COOKIE_NAME || "invitation_session",
    days: Number(process.env.SESSION_DAYS) || 30
  },
  payment: {
    placeholderPath: process.env.PAYMENT_PATH || "/payment"
  },
  email: {
    enabled: process.env.EMAIL_ENABLED === "true",
    defaultProvider: process.env.EMAIL_PROVIDER || "resend",
    verifyProvider: process.env.VERIFY_EMAIL_PROVIDER || process.env.EMAIL_PROVIDER || "resend",
    resetProvider: process.env.RESET_PASSWORD_EMAIL_PROVIDER || process.env.EMAIL_PROVIDER || "resend",
    from: process.env.EMAIL_FROM || "Invitation Studio <onboarding@resend.dev>",
    replyTo: process.env.EMAIL_REPLY_TO || "",
    verifyTokenMinutes: Number(process.env.EMAIL_VERIFY_TOKEN_MINUTES) || 60,
    resetTokenMinutes: Number(process.env.PASSWORD_RESET_TOKEN_MINUTES) || 30,
    rateLimitPerSecond: Number(process.env.EMAIL_RATE_LIMIT_PER_SECOND) || 10,
    rateLimitPerDay: Number(process.env.EMAIL_RATE_LIMIT_PER_DAY) || 100,
    providers: {
      resend: {
        apiKey: process.env.RESEND_API_KEY || "",
        apiUrl: process.env.RESEND_API_URL || "https://api.resend.com/emails"
      }
    }
  },
  api: {
    maxJsonBodyBytes: Number(process.env.MAX_JSON_BODY_BYTES) || 1_000_000
  },
  routing: {
    pageRoutes: ["/", "/login", "/admin", "/payment", "/verify-email", "/reset-password", "/wedding", "/birthday", "/engagement", "/office"],
    shareRoutePrefix: "/share/"
  },
  staticFiles: {
    contentTypes: {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml"
    },
    fallbackContentType: "application/octet-stream"
  }
};

module.exports = { config };
