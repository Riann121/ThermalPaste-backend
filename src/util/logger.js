/**
 * logger.js (util)
 * Custom colored server loggers used for startup and lifecycle messages.
 */
const colors = require("colors");

// Informational message (cyan)
const info = (msg) => console.log(colors.cyan(`[INFO]  ${msg}`));
// Success message (green background, black text)
const success = (msg) => console.log(colors.bgGreen.black(`[OK]    ${msg}`));
// Warning message (yellow)
const warn = (msg) => console.log(colors.yellow(`[WARN]  ${msg}`));
// Error message (red)
const error = (msg) => console.log(colors.red(`[ERROR] ${msg}`));

module.exports = { info, success, warn, error };
