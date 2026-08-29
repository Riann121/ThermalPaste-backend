/**
 * server.js
 * Application entry point.
 * Loads environment variables, builds the app, and starts listening.
 */
require("dotenv").config();
const createApp = require("./src/app");
const { success, info } = require("./src/util/logger");

// Port defaults to 4000 unless overridden in the environment
const PORT = process.env.PORT || 4000;

// Build the Express app from the factory
const app = createApp();

// Start the HTTP server and log startup details
app.listen(PORT, () => {
  info(`Environment: ${process.env.NODE_ENV || "development"}`);
  success(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
