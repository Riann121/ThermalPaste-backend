/**
 * healthController
 * Presenter layer for the health feature.
 * Receives the HTTP request, delegates to the service, and returns a response.
 */
const healthService = require("../services/healthService");
const { SuccessHandler } = require("../util/successHandler");

/**
 * GET /health handler.
 * Fetches status from the service and sends a custom success response.
 */
function check(req, res, next) {
  try {
    // Ask the service for the current server status
    const status = healthService.getStatus();
    // Respond using the custom success handler
    return SuccessHandler(status, res, 200, "Health check passed successfully");
  } catch (error) {
    // Forward unexpected errors to the global error handler
    next(error);
  }
}

module.exports = { check };
