// Builds the Express app and wires middleware, routes, and error handlers.
import "dotenv/config";
import express from "express";
import cors from "cors";
import logger from "./middleware/logger.js";
import { ErrorHandler } from "./util/errorHandler.js";
import healthRoutes from "./routes/healthRoutes.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(logger);
  app.use(healthRoutes);

  app.use((req, res) => ErrorHandler(res, 404, "Not found"));
  app.use((err, req, res, next) => ErrorHandler(res, 500, "Internal server error", err));

  return app;
}
