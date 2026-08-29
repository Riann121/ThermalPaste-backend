import cors from "cors";
import cookieParser from "cookie-parser";
import "dotenv/config";
import express from "express";
import logger from "./middleware/logger.js";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRouter.js";
import { ErrorHandler } from "./util/errorHandler.js";
import mongoose from "mongoose";

export default function createApp() {
  const app = express();

  const connectDB = async () => {
    try {
      await mongoose.connect(process.env.DATABASE_URL);
      console.log("Connected to database");
    } catch (err) {
      console.log(`Error connecting to database ${err}`);
      process.exit(1);
    }
  };

  connectDB();

  app.use(
    cors({
      credentials: true,
      origin: process.env.ALLOWED_ORIGIN,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(logger);
  app.use(healthRoutes);
  app.use(authRoutes);

  app.use((req, res) => ErrorHandler(res, 404, "Not found"));
  app.use((err, req, res, next) =>
    ErrorHandler(res, 500, "Internal server error", err),
  );

  return app;
}
