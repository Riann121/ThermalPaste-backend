// Returns the server health status (status, uptime, timestamp).
export function getStatus() {
  return {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}
