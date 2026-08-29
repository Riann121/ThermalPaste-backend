// Sends a standardized success response and logs it.
import colors from "colors";

export function SuccessHandler(data, res, status, msg, service = "user-service") {
  console.log(colors.bgBlue(`SUCCESS [${status}]: ${msg}`));

  res.status(status).json({
    status,
    success: true,
    data,
    info: { service, message: msg, gatewayInfo: msg },
  });
}
