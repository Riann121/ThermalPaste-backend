import express from "express";
import checkToken from "../middleware/checkToken.js";
import optionalToken from "../middleware/optionalToken.js";
import {
  createPost,
  getPostById,
  updatePost,
  deletePost,
} from "../controllers/postController.js";

const router = express.Router();

// POST /api/posts — Create a new post
router.post("/", checkToken, createPost);

// GET /api/posts/:id — Get a post by ID
router.get("/:id", optionalToken, getPostById);

// PUT /api/posts/:id — Edit a post (Owner only)
router.put("/:id", checkToken, updatePost);

// DELETE /api/posts/:id — Delete a post (Owner only, cascades related records)
router.delete("/:id", checkToken, deletePost);

export default router;
