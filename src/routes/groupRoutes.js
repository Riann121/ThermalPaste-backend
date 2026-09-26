import express from "express";
import checkToken from "../middleware/checkToken.js";
import optionalToken from "../middleware/optionalToken.js";
import {
  createGroup,
  getGroups,
  getGroupByIdOrName,
  updateGroup,
  joinGroup,
  leaveGroup,
  getJoinRequests,
  handleJoinRequest,
} from "../controllers/groupController.js";
import { getGroupPosts } from "../controllers/postController.js";

const router = express.Router();

// List & search groups (public or membership-aware)
router.get("/", optionalToken, getGroups);

// Create a group
router.post("/", checkToken, createGroup);

// Get paginated posts for a group
router.get("/:idOrName/posts", optionalToken, getGroupPosts);

// Get single group details by _id or name slug
router.get("/:idOrName", optionalToken, getGroupByIdOrName);

// Update group settings (Creator only, no delete)
router.patch("/:id", checkToken, updateGroup);

// Membership actions
router.post("/:id/join", checkToken, joinGroup);
router.post("/:id/leave", checkToken, leaveGroup);

// Private group join requests (Creator only)
router.get("/:id/requests", checkToken, getJoinRequests);
router.patch("/:id/requests/:userId", checkToken, handleJoinRequest);

export default router;
