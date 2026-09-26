import { co2 } from "@tgwf/co2";

// Initialize CO2.js with the Sustainable Web Design (SWD) model
const co2Emission = new co2({ model: "swd" });

export default function carbonTracker(req, res, next) {
  let requestBytes = 0;
  let responseBytes = 0;

  // Calculate request payload size
  if (req.body) {
    try {
      requestBytes += Buffer.byteLength(JSON.stringify(req.body), "utf8");
    } catch {
      // Fallback if circular or non-serializable
    }
  }
  if (req.query) {
    try {
      requestBytes += Buffer.byteLength(JSON.stringify(req.query), "utf8");
    } catch {
      // Fallback
    }
  }
  if (req.headers) {
    try {
      requestBytes += Buffer.byteLength(JSON.stringify(req.headers), "utf8");
    } catch {
      // Fallback
    }
  }

  // Intercept response write and end to calculate response size
  const originalWrite = res.write;
  const originalEnd = res.end;

  res.write = function (chunk, ...args) {
    if (chunk) {
      responseBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, "utf8");
    }
    return originalWrite.apply(res, [chunk, ...args]);
  };

  res.end = function (chunk, ...args) {
    if (chunk) {
      responseBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, "utf8");
    }

    const totalBytes = requestBytes + responseBytes;
    res.locals.totalBytes = totalBytes;

    // Calculate emissions in grams of CO2 (greenHost: false)
    const emissions = co2Emission.perByte(totalBytes, false);
    res.locals.co2Emissions = emissions;

    console.log(
      `[CO2 Tracker] ${req.method} ${req.originalUrl || req.url} | ${totalBytes} B | ~${emissions.toFixed(4)}g CO2e`
    );

    return originalEnd.apply(res, [chunk, ...args]);
  };

  next();
}
