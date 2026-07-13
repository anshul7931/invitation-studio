/**
 * Mapping and normalization helpers for users and invitations.
 */
const crypto = require("crypto");
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
  const publicExpiresAt = row.public_expires_at ? new Date(row.public_expires_at) : null;
  return {
    id: row.id,
    occasion: row.occasion,
    title: row.title,
    fields: typeof row.fields === "string" ? JSON.parse(row.fields) : row.fields,
    url: `/${row.occasion}?id=${row.id}`,
    shareUrl: row.public_token ? `/share/${row.public_token}` : null,
    publicExpiresAt: publicExpiresAt ? publicExpiresAt.toISOString() : null,
    publicGeneratedAt: row.public_generated_at ? new Date(row.public_generated_at).toISOString() : null,
    status: row.status,
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
