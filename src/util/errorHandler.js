// Sends a standardized error response and logs it.
import colors from "colors";

export function ErrorHandler(res, status, msg, error, service = "user-service") {
  console.log(colors.bgRed(`ERROR [${status}]: ${msg}`));

  res.status(status).json({
    status,
    success: false,
    message: msg,
    error: error ? error.message : undefined,
    info: { service, message: msg, gatewayInfo: msg },
  });
}
