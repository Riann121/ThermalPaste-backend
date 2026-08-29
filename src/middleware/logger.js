// Logs each request on entry and its status + duration on finish.
import colors from "colors";

export default function logger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl } = req;

  console.log(colors.gray(`--> ${method} ${originalUrl} @ ${new Date().toISOString()}`));

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const statusColor =
      statusCode >= 500 ? colors.red : statusCode >= 400 ? colors.yellow : colors.green;
    console.log(statusColor(`<-- ${method} ${originalUrl} ${statusCode} ${duration}ms`));
  });

  next();
}
