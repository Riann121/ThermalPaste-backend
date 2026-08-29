/**
 * logger.js (middleware)
 * Detailed request logger.
 * Logs each request on entry and its outcome (status + duration) on finish.
 */
const colors = require("colors");

function logger(req, res, next) {
  // Record the start time so we can measure response duration
  const start = Date.now();
  const { method, originalUrl } = req;

  // Log the incoming request with a timestamp
  console.log(
    colors.gray(`--> ${method} ${originalUrl} @ ${new Date().toISOString()}`)
  );

  // When the response finishes, log status and how long it took
  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    // Color the result line by status class
    const statusColor =
      statusCode >= 500
        ? colors.red
        : statusCode >= 400
        ? colors.yellow
        : colors.green;

    console.log(statusColor(`<-- ${method} ${originalUrl} ${statusCode} ${duration}ms`));
  });

  next();
}

module.exports = logger;
