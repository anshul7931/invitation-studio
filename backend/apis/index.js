/**
 * API router aggregator.
 * Each module owns one functional area; this file keeps route order explicit.
 */
const { handleAdminApi } = require("./admin-api");
const { handleAuthApi } = require("./auth-api");
const { handleInvitationApi } = require("./invitation-api");
const { handleOccasionApi } = require("./occasion-api");
const { handleProfileApi } = require("./profile-api");
const { handlePublicApi } = require("./public-api");

const apiHandlers = [
  handleAuthApi,
  handleProfileApi,
  handleAdminApi,
  handleOccasionApi,
  handlePublicApi,
  handleInvitationApi
];

async function handleApi(request, response, pathname) {
  for (const handler of apiHandlers) {
    if (await handler(request, response, pathname)) return true;
  }
  return false;
}

module.exports = { handleApi };
