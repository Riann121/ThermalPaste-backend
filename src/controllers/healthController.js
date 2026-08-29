// Handles GET /health: fetches status and returns a success response.
import { getStatus } from "../services/healthService.js";
import { SuccessHandler } from "../util/successHandler.js";

export function check(req, res, next) {
  try {
    const status = getStatus();
    return SuccessHandler(status, res, 200, "Health check passed successfully");
  } catch (error) {
    next(error);
  }
}
