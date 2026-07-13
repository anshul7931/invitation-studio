/**
 * Authentication/authorization guards for API route modules.
 */
const { currentUser } = require("../auth");
const { sendJson } = require("../utils/http");

async function requireUser(request, response) {
  const user = await currentUser(request);
  if (!user) sendJson(response, 401, { error: "Authentication required" });
  return user;
}

async function requireAdmin(request, response) {
  const user = await requireUser(request, response);
  if (!user) return null;
  if (user.role !== "ADMIN") {
    sendJson(response, 403, { error: "Admin access required" });
    return null;
  }
  return user;
}

module.exports = {
  requireAdmin,
  requireUser
};
