import mongoose from "mongoose";
import { Post } from "../models/Post.js";
import { Group } from "../models/Group.js";
import { Comment } from "../models/Comment.js";
import { Vote } from "../models/Vote.js";
import { SavedPost } from "../models/SavedPost.js";
import { UserProfile } from "../models/UserProfile.js";
import { SuccessHandler } from "../util/successHandler.js";
import { ErrorHandler } from "../util/errorHandler.js";

// Helper: Sanitize group slug name
function sanitizeGroupName(rawName) {
  if (!rawName) return "";
  return rawName
    .trim()
    .toLowerCase()
    .replace(/^g\//, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

// Helper: Format post document with author avatar, comment count, and saved status
export async function formatPost(postDoc, currentUserId = null) {
  const doc = postDoc.toObject ? postDoc.toObject() : { ...postDoc };

  let authorImage = "";
  if (doc.user?._id) {
    const profile = await UserProfile.findOne({ user: doc.user._id }).select("imageLink");
    authorImage = profile?.imageLink || "";
  }

  const commentsCount = await Comment.countDocuments({ post: doc._id });

  let isSaved = false;
  if (currentUserId) {
    const saved = await SavedPost.findOne({ user: currentUserId, post: doc._id });
    isSaved = !!saved;
  }

  const isOwner =
    currentUserId && doc.user?._id
      ? doc.user._id.toString() === currentUserId
      : false;

  return {
    _id: doc._id,
    heading: doc.heading,
    description: doc.description,
    imageLink: doc.imageLink,
    user: {
      _id: doc.user?._id || doc.user,
      username: doc.user?.username || "",
      imageLink: authorImage,
    },
    group: doc.group,
    commentsCount,
    isSaved,
    isOwner,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// POST /api/posts
// Create a new post in a public group or a private group where user is a member/creator
export async function createPost(req, res, next) {
  try {
    const { group, heading, description, imageLink } = req.body;

    if (!group) {
      return ErrorHandler(res, 400, "Group identifier is required", undefined, "post-service");
    }

    if (!heading || !heading.trim()) {
      return ErrorHandler(res, 400, "Post heading is required", undefined, "post-service");
    }

    // Resolve group by ObjectId or slug name
    const isObjectId = mongoose.Types.ObjectId.isValid(group);
    const cleanIdentifier = sanitizeGroupName(group);

    const targetGroup = await Group.findOne(
      isObjectId
        ? { $or: [{ _id: group }, { name: cleanIdentifier }] }
        : { name: cleanIdentifier },
    );

    if (!targetGroup) {
      return ErrorHandler(res, 404, "Group not found", undefined, "post-service");
    }

    // Privacy verification: If group is private, user must be a member or creator
    if (targetGroup.privacy === "private") {
      const userId = req.user.id;
      const isMember = targetGroup.members.some((m) => m.toString() === userId);
      const isCreator = targetGroup.creator.toString() === userId;

      if (!isMember && !isCreator) {
        return ErrorHandler(
          res,
          403,
          "You must be a member of this private group to post in it",
          undefined,
          "post-service",
        );
      }
    }

    const newPost = await Post.create({
      user: req.user.id,
      group: targetGroup._id,
      heading: heading.trim(),
      description: description?.trim() || "",
      imageLink: imageLink?.trim() || "",
    });

    const populated = await Post.findById(newPost._id)
      .populate("user", "username")
      .populate("group", "name groupIconLink privacy");

    const formatted = await formatPost(populated, req.user.id);

    return SuccessHandler(
      { post: formatted },
      res,
      201,
      "Post created successfully",
      "post-service",
    );
  } catch (error) {
    next(error);
  }
}

// GET /api/posts/:id
// Get a single post by ID (checks group privacy for non-members)
export async function getPostById(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ErrorHandler(res, 400, "Invalid post ID", undefined, "post-service");
    }

    const post = await Post.findById(id)
      .populate("user", "username")
      .populate("group", "name groupIconLink privacy members creator");

    if (!post) {
      return ErrorHandler(res, 404, "Post not found", undefined, "post-service");
    }

    // Privacy check: If group is private, only members or creator can view
    if (post.group?.privacy === "private") {
      const currentUserId = req.user?.id;
      const isMember = currentUserId
        ? post.group.members.some((m) => m.toString() === currentUserId)
        : false;
      const isCreator = currentUserId
        ? post.group.creator.toString() === currentUserId
        : false;

      if (!isMember && !isCreator) {
        return ErrorHandler(
          res,
          403,
          "This post belongs to a private group that you are not a member of",
          undefined,
          "post-service",
        );
      }
    }

    const currentUserId = req.user?.id || null;
    const formatted = await formatPost(post, currentUserId);

    return SuccessHandler(
      { post: formatted },
      res,
      200,
      "Post fetched successfully",
      "post-service",
    );
  } catch (error) {
    next(error);
  }
}

// PUT /api/posts/:id
// Edit an existing post (Owner only)
export async function updatePost(req, res, next) {
  try {
    const { id } = req.params;
    const { heading, description, imageLink } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ErrorHandler(res, 400, "Invalid post ID", undefined, "post-service");
    }

    const post = await Post.findById(id);
    if (!post) {
      return ErrorHandler(res, 404, "Post not found", undefined, "post-service");
    }

    if (post.user.toString() !== req.user.id) {
      return ErrorHandler(
        res,
        403,
        "Permission denied: You can only edit your own posts",
        undefined,
        "post-service",
      );
    }

    if (heading !== undefined) {
      if (!heading || !heading.trim()) {
        return ErrorHandler(res, 400, "Post heading cannot be empty", undefined, "post-service");
      }
      post.heading = heading.trim();
    }

    if (description !== undefined) {
      post.description = description.trim();
    }

    if (imageLink !== undefined) {
      post.imageLink = imageLink.trim();
    }

    await post.save();

    const populated = await Post.findById(post._id)
      .populate("user", "username")
      .populate("group", "name groupIconLink privacy");

    const formatted = await formatPost(populated, req.user.id);

    return SuccessHandler(
      { post: formatted },
      res,
      200,
      "Post updated successfully",
      "post-service",
    );
  } catch (error) {
    next(error);
  }
}

// DELETE /api/posts/:id
// Delete post and cascade delete comments, saved posts, and votes (Owner only)
export async function deletePost(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ErrorHandler(res, 400, "Invalid post ID", undefined, "post-service");
    }

    const post = await Post.findById(id);
    if (!post) {
      return ErrorHandler(res, 404, "Post not found", undefined, "post-service");
    }

    if (post.user.toString() !== req.user.id) {
      return ErrorHandler(
        res,
        403,
        "Permission denied: You can only delete your own posts",
        undefined,
        "post-service",
      );
    }

    await Post.findByIdAndDelete(id);

    // Cascade deletions
    await Comment.deleteMany({ post: id });
    await SavedPost.deleteMany({ post: id });
    await Vote.deleteMany({ targetType: "Post", targetId: id });
    await UserProfile.updateMany({ likedPosts: id }, { $pull: { likedPosts: id } });

    return SuccessHandler(
      null,
      res,
      200,
      "Post and all related comments, bookmarks, and votes deleted successfully",
      "post-service",
    );
  } catch (error) {
    next(error);
  }
}
