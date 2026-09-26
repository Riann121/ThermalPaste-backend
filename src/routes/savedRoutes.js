import express from "express";
import checkToken from "../middleware/checkToken.js";
import { getSavedPosts } from "../controllers/postController.js";

const router = express.Router();

// GET /api/saved — Get saved posts for authenticated user
router.get("/", checkToken, getSavedPosts);

export default router;
