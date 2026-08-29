/**
 * successHandler.js
 * Custom success response handler.
 * Logs a colored SUCCESS line and sends a consistent JSON envelope.
 */
const colors = require("colors");

/**
 * Builds and sends a success response.
 * @param {*} data     - payload to return
 * @param {object} res  - Express response object
 * @param {number} status - HTTP status code
 * @param {string} msg   - custom success message
 * @param {string} [service] - originating service name
 */
const SuccessHandler = (data, res, status, msg, service = "user-service") => {
  // Log the success with status and message
  console.log(colors.bgBlue(`SUCCESS [${status}]: ${msg}`));

  // Send the standardized success envelope
  res.status(status).json({
    status: status,
    success: true,
    data: data,
    info: {
      service: service,
      message: msg,
      gatewayInfo: msg,
    },
  });
};

module.exports = { SuccessHandler };
