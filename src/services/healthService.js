/**
 * healthService
 * Model / business-logic layer for the health feature.
 * Provides the data used to describe the server's current state.
 */

/**
 * Returns the current health status of the server.
 * @returns {{ status: string, uptime: number, timestamp: string }}
 */
function getStatus() {
  return {
    status: "ok", // overall status indicator
    uptime: process.uptime(), // seconds the process has been running
    timestamp: new Date().toISOString(), // ISO timestamp of the check
  };
}

module.exports = { getStatus };
