/**
 * Mapping and normalization helpers for users and invitations.
 */
const crypto = require("crypto");
const { config } = require("../config");
const { occasions } = require("../occasion-schema");

function invitationTitle(occasion, fields) {
  const schema = occasions[occasion];
  const title = schema.titleFields
    .map((field) => String(fields[field] || "").trim())
    .filter(Boolean)
    .join(" & ");
  return `${title}${schema.titleSuffix || ""}`;
}

function invitationDto(row) {
  const fields = typeof row.fields === "string" ? JSON.parse(row.fields) : row.fields;
  let publicExpiresAt = row.public_expires_at ? new Date(row.public_expires_at) : null;
  const isPremium = fields.templateType === "premium" || String(fields.photoLinks || "").trim().length > 0;
  if (isPremium && row.public_generated_at) {
    publicExpiresAt = new Date(new Date(row.public_generated_at).getTime() + 5 * 60 * 1000);
  } else if (publicExpiresAt && row.public_generated_at && config.app.publicShareMinutes !== 10) {
    publicExpiresAt = new Date(new Date(row.public_generated_at).getTime() + config.app.publicShareMinutes * 60 * 1000);
  }
  const status = row.status === "PAID"
    ? "PAID"
    : row.status === "PUBLISHED" && publicExpiresAt && publicExpiresAt.getTime() <= Date.now()
      ? "EXPIRED"
      : row.status || "DRAFT";
  return {
    id: row.id,
    occasion: row.occasion,
    title: row.title,
    fields,
    url: `/${row.occasion}?id=${row.id}`,
    shareUrl: row.public_token ? `/share/${row.public_token}` : null,
    publicExpiresAt: publicExpiresAt ? publicExpiresAt.toISOString() : null,
    publicGeneratedAt: row.public_generated_at ? new Date(row.public_generated_at).toISOString() : null,
    status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function userDto(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || "",
    role: row.role,
    emailVerified: Boolean(row.email_verified_at)
  };
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function fingerprintFor(occasion, fields) {
  const importantKeys = occasions[occasion].fingerprintFields;
  const normalized = Object.fromEntries(
    importantKeys.map((key) => [key, String(fields[key] || "").trim().toLowerCase()])
  );
  return crypto.createHash("sha256").update(JSON.stringify({ occasion, normalized })).digest("hex");
}

module.exports = {
  fingerprintFor,
  invitationDto,
  invitationTitle,
  tokenHash,
  userDto
};
