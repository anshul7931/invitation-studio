const fs = require("fs");
const path = require("path");

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = unquote(trimmed.slice(index + 1));
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function loadLocalEnv() {
  const appRoot = path.join(__dirname, "..");
  loadEnvFile(path.join(appRoot, ".env"));
  loadEnvFile(path.join(appRoot, ".env.local"));
}

module.exports = { loadLocalEnv };
