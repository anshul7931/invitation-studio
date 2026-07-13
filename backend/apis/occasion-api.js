/**
 * Occasion metadata APIs.
 */
const { occasions } = require("../occasion-schema");
const { sendJson } = require("../utils/http");

async function handleOccasionApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/occasions") {
    sendJson(response, 200, {
      occasions: Object.entries(occasions).map(([id, config]) => ({
        id,
        required: config.required,
        defaults: config.defaults
      }))
    });
    return true;
  }

  const configMatch = pathname.match(/^\/api\/occasions\/([^/]+)$/);
  if (request.method === "GET" && configMatch) {
    const config = occasions[configMatch[1]];
    sendJson(response, config ? 200 : 404, config || { error: "Unknown occasion" });
    return true;
  }

  return false;
}

module.exports = { handleOccasionApi };
