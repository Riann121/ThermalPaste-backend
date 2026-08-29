/**
 * errorHandler.js
 * Custom error response handler.
 * Mirrors successHandler's envelope for failed responses.
 */
const colors = require("colors");

/**
 * Builds and sends an error response.
 * @param {object} res    - Express response object
 * @param {number} status - HTTP status code
 * @param {string} msg    - custom error message
 * @param {Error} [error] - optional error object for debugging
 * @param {string} [service] - originating service name
 */
const ErrorHandler = (res, status, msg, error, service = "user-service") => {
  // Log the error with status and message
  console.log(colors.bgRed(`ERROR [${status}]: ${msg}`));

  // Send the standardized error envelope
  res.status(status).json({
    status: status,
    success: false,
    message: msg,
    error: error ? error.message : undefined,
    info: {
      service: service,
      message: msg,
      gatewayInfo: msg,
    },
  });
};

module.exports = { ErrorHandler };
