/**
 * healthRoutes
 * View layer for the health feature.
 * Maps HTTP endpoints to their controller handlers.
 */
const express = require("express");
const router = express.Router();
const healthController = require("../controllers/healthController");

// Mounted at "/health" by app.js, so this handles GET /health
router.get("/", healthController.check);

module.exports = router;
