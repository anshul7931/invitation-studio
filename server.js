/**
 * Root launcher kept intentionally small.
 * Backend modules live under ./backend.
 */
const { start } = require("./backend/app");

start().catch((error) => {
  console.error("Unable to start Invitation Studio:", error.message);
  process.exitCode = 1;
});
