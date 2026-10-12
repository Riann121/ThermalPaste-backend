import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import logger from "./middleware/logger.js";
import authRoutes from "./routes/authRouter.js";
import healthRoutes from "./routes/healthRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import commentVoteRoutes from "./routes/commentVoteRoutes.js";
import groupRoutes from "./routes/groupRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import savedRoutes from "./routes/savedRoutes.js";
import { ErrorHandler } from "./util/errorHandler.js";

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
  app.use("/api/auth", authRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/comments", commentRoutes);
  app.use("/api/comments", commentVoteRoutes);
  app.use("/api/groups", groupRoutes);
  app.use("/api/posts", postRoutes);
  app.use("/api/saved", savedRoutes);

  app.use((req, res) => ErrorHandler(res, 404, "Not found"));
  app.use((err, req, res, next) =>
    ErrorHandler(res, 500, "Internal server error", err),
  );

  return app;
}
