// Sends a standardized error response and logs it.
import colors from "colors";

export function ErrorHandler(res, status, msg, error, service = "user-service", redirect) {
  console.log(colors.bgRed(`ERROR [${status}]: ${msg}`));

  const body = {
    status,
    success: false,
    message: msg,
    error: error ? error.message : undefined,
    info: { service, message: msg, gatewayInfo: msg },
  };

  if (redirect) body.redirect = redirect;

  res.status(status).json(body);
}
