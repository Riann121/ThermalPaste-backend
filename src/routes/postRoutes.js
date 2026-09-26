import express from "express";
import checkToken from "../middleware/checkToken.js";
import optionalToken from "../middleware/optionalToken.js";
import { uploadPost } from "../middleware/upload.js";
import {
  createPost,
  getFeed,
  getPostById,
  updatePost,
  deletePost,
  toggleSavePost,
  getSavedPosts,
  reactPost,
  getPostReaction,
  uploadPostImage,
} from "../controllers/postController.js";
import { getComments } from "../controllers/commentController.js";

const router = express.Router();

// GET /api/posts — Feed of posts across groups (respects privacy, paginated)
router.get("/", optionalToken, getFeed);

// GET /api/posts/saved — Saved posts for authenticated user (must be before /:id)
router.get("/saved", checkToken, getSavedPosts);

// POST /api/posts/image — Upload post image to Cloudinary (must be before /:id)
router.post("/image", checkToken, uploadPost.single("image"), uploadPostImage);

// POST /api/posts/:id/image — Upload/update post image by ID
router.post("/:id/image", checkToken, uploadPost.single("image"), uploadPostImage);

// POST /api/posts — Create a new post (supports both JSON body & multipart/form-data)
router.post("/", checkToken, uploadPost.single("image"), createPost);

// POST /api/posts/:id/save — Toggle save/bookmark on a post
router.post("/:id/save", checkToken, toggleSavePost);

// POST /api/posts/:id/react — React to a post (upvote / downvote)
router.post("/:id/react", checkToken, reactPost);
router.post("/:id/vote", checkToken, reactPost);

// GET /api/posts/:id/react — Get reactions & user's reaction for a post
router.get("/:id/react", optionalToken, getPostReaction);
router.get("/:id/vote", optionalToken, getPostReaction);

// GET /api/posts/:postId/comments — Comments for post (convenience alias)
router.get("/:postId/comments", checkToken, getComments);

// GET /api/posts/:id — Get a post by ID
router.get("/:id", optionalToken, getPostById);

// PUT /api/posts/:id — Edit a post (supports both JSON body & multipart/form-data)
router.put("/:id", checkToken, uploadPost.single("image"), updatePost);

// DELETE /api/posts/:id — Delete a post (Owner only, cascades related records)
router.delete("/:id", checkToken, deletePost);

export default router;

