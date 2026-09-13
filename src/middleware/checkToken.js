import jwt from "jsonwebtoken";
import { ErrorHandler } from "../util/errorHandler.js";

export default function checkToken(req, res, next) {
  const token = req.cookies?.accessToken || req.cookies?.token;

  if (!token) {
    return ErrorHandler(res, 401, "Invalid token");
  }

  jwt.verify(token, process.env.JWT_SECRET, {}, (err, user) => {
    if (err) {
      // Token expired: return 401 so the client can trigger silent refresh.
      if (err.name === "TokenExpiredError") {
        return ErrorHandler(res, 401, "Token expired", err);
      }
      return ErrorHandler(res, 401, "Invalid token");
    }
    req.user = user;
    next();
  });
}