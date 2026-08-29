// Defines health HTTP routes.
import express from "express";
import { check } from "../controllers/healthController.js";

const router = express.Router();

// GET /health
router.get("/health", check);

export default router;
