import express from "express";
import checkToken from "../middleware/checkToken.js";
import {
  createComment,
  getComments,
  updateComment,
  deleteComment,
} from "../controllers/commentController.js";

const router = express.Router();

// POST /api/comments       — create a comment or a reply
router.post("/", checkToken, createComment);

// GET /api/posts/:postId/comments — fetch all comments for a post as a tree
router.get("/posts/:postId/comments", checkToken, getComments);

// PUT /api/comments/:commentId   — update a comment
router.put("/:commentId", checkToken, updateComment);

// DELETE /api/comments/:commentId — delete a comment (and its replies)
router.delete("/:commentId", checkToken, deleteComment);

export default router;
