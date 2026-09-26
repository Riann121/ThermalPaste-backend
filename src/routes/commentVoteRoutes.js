import express from "express";
import checkToken from "../middleware/checkToken.js";
import optionalToken from "../middleware/optionalToken.js";
import {
  voteComment,
  getCommentVotes,
  getCommentVotesBatch,
} from "../controllers/commentVoteController.js";

const router = express.Router();

// POST /api/comments/:commentId/react - React to a comment (upvote/downvote) - matches post route
router.post("/:commentId/react", checkToken, voteComment);

// POST /api/comments/:commentId/vote - Toggle upvote/downvote (auth required)
router.post("/:commentId/vote", checkToken, voteComment);

// GET /api/comments/:commentId/react - Get reaction counts (optional auth) - matches post route
router.get("/:commentId/react", optionalToken, getCommentVotes);

// GET /api/comments/:commentId/votes - Get vote counts (optional auth)
router.get("/:commentId/votes", optionalToken, getCommentVotes);

// POST /api/comments/votes/batch - Batch fetch votes for multiple comments
router.post("/votes/batch", optionalToken, getCommentVotesBatch);

export default router;