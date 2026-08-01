/**
 * Shared validation helpers for account input.
 */
function isValidPhone(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  return /^[0-9]{10}$/.test(text);
}

function isValidPassword(value) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(value || ""));
}

module.exports = { isValidPassword, isValidPhone };
