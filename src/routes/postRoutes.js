import express from "express";
import checkToken from "../middleware/checkToken.js";
import optionalToken from "../middleware/optionalToken.js";
import {
  createPost,
  getFeed,
  getPostById,
  updatePost,
  deletePost,
  toggleSavePost,
  getSavedPosts,
} from "../controllers/postController.js";

const router = express.Router();

// GET /api/posts — Feed of posts across groups (respects privacy, paginated)
router.get("/", optionalToken, getFeed);

// GET /api/posts/saved — Saved posts for authenticated user (must be before /:id)
router.get("/saved", checkToken, getSavedPosts);

// POST /api/posts — Create a new post
router.post("/", checkToken, createPost);

// POST /api/posts/:id/save — Toggle save/bookmark on a post
router.post("/:id/save", checkToken, toggleSavePost);

// GET /api/posts/:id — Get a post by ID
router.get("/:id", optionalToken, getPostById);

// PUT /api/posts/:id — Edit a post (Owner only)
router.put("/:id", checkToken, updatePost);

// DELETE /api/posts/:id — Delete a post (Owner only, cascades related records)
router.delete("/:id", checkToken, deletePost);

export default router;
