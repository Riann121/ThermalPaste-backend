import jwt from "jsonwebtoken";

export default function optionalToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

  const token = req.cookies?.accessToken || req.cookies?.token || bearerToken;

  if (!token) {
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET, {}, (err, user) => {
    if (!err && user) {
      req.user = user;
    }
    next();
  });
}
