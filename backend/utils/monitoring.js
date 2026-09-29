/**
 * Lightweight in-memory monitoring log for recent server issues.
 * This can later be replaced with a durable logging provider.
 */
const logs = [];
const MAX_LOGS = 100;

function recordIssue({ level = "ERROR", message, path = "", stack = "", user = null }) {
  logs.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    level,
    message: String(message || "Unexpected issue"),
    path,
    stack: String(stack || "").slice(0, 2000),
    user: user ? { id: user.id, name: user.name, email: user.email } : null,
    createdAt: new Date().toISOString()
  });
  logs.splice(MAX_LOGS);
}

function recentIssues() {
  return logs;
}

module.exports = { recentIssues, recordIssue };
