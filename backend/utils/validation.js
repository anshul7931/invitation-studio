/**
 * Shared validation helpers for account input.
 */
function isValidPhone(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  const digits = text.replace(/\D/g, "");
  return /^\+?[0-9\s-]+$/.test(text) && digits.length >= 10 && digits.length <= 15;
}

function isValidPassword(value) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(value || ""));
}

module.exports = { isValidPassword, isValidPhone };
