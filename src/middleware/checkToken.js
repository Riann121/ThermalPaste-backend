// Verifies the JWT and attaches the decoded user to the request. Does not remove the token.
import jwt from "jsonwebtoken";
import { ErrorHandler } from "../util/errorHandler.js";

export default function checkToken(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return ErrorHandler(res, 401, "Invalid token");
  }

  jwt.verify(token, process.env.JWT_SECRET, {}, (err, user) => {
    if (err) {
      return ErrorHandler(res, 401, "Invalid token");
    }
    req.user = user;
    next();
  });
}
