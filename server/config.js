/**
 * Central application configuration.
 * Environment variables override these defaults; README documents each option.
 */
const config = {
  app: {
    name: process.env.APP_NAME || "Invitation Studio",
    host: process.env.HOST || "127.0.0.1",
    port: Number(process.env.PORT) || 3000,
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
  api: {
    maxJsonBodyBytes: Number(process.env.MAX_JSON_BODY_BYTES) || 1_000_000
  },
  routing: {
    pageRoutes: ["/", "/login", "/admin", "/payment", "/wedding", "/birthday", "/engagement", "/office"],
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
