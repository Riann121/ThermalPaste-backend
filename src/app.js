/**
 * app.js
 * Assembles the Express application: middleware, routes, and error handling.
 * Exports a factory so the app can be created (and tested) without auto-listening.
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const logger = require("./middleware/logger");
const { ErrorHandler } = require("./util/errorHandler");
const healthRoutes = require("./routes/healthRoutes");

function createApp() {
  const app = express();

  // Enable Cross-Origin Resource Sharing
  app.use(cors());
  // Parse incoming JSON request bodies
  app.use(express.json());
  // Log every incoming request (method, url, status, duration)
  app.use(logger);

  // Mount feature routes under their base paths
  app.use("/health", healthRoutes);

  // 404 handler: no route matched the request
  app.use((req, res) => ErrorHandler(res, 404, "Not found"));

  // Global error handler: catches errors forwarded via next(err)
  app.use((err, req, res, next) => {
    ErrorHandler(res, 500, "Internal server error", err);
  });

  return app;
}

module.exports = createApp;
