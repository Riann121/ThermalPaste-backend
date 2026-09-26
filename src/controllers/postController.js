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

// Helper: Format post document with author avatar, comment count, saved status, and reaction counts
export async function formatPost(postDoc, currentUserId = null) {
  const doc = postDoc.toObject ? postDoc.toObject() : { ...postDoc };

  let authorImage = "";
  if (doc.user?._id) {
    const profile = await UserProfile.findOne({ user: doc.user._id }).select("imageLink");
    authorImage = profile?.imageLink || "";
  }

  const commentsCount = await Comment.countDocuments({ post: doc._id });

  let isSaved = false;
  let userReaction = null;

  if (currentUserId) {
    const saved = await SavedPost.findOne({ user: currentUserId, post: doc._id });
    isSaved = !!saved;

    const userVote = await Vote.findOne({
      user: currentUserId,
      targetType: "Post",
      targetId: doc._id,
    });
    if (userVote) {
      userReaction = userVote.value === 1 ? "upvote" : "downvote";
    }
  }

  const isOwner =
    currentUserId && doc.user?._id
      ? doc.user._id.toString() === currentUserId
      : false;

  const reactCount = doc.reactCount || { upvote: 0, downvote: 0 };

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
    reactCount,
    reactcount: reactCount,
    userReaction,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// Helper: Batch-format multiple posts
export async function batchFormatPosts(posts, currentUserId = null) {
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p) => p._id);
  const userIds = [...new Set(posts.map((p) => p.user?._id).filter(Boolean))];

  const profiles = await UserProfile.find({ user: { $in: userIds } }).select("user imageLink");
  const avatarMap = new Map();
  profiles.forEach((p) => avatarMap.set(p.user.toString(), p.imageLink || ""));

  const commentCounts = await Comment.aggregate([
    { $match: { post: { $in: postIds } } },
    { $group: { _id: "$post", count: { $sum: 1 } } },
  ]);
  const commentCountMap = new Map();
  commentCounts.forEach((c) => commentCountMap.set(c._id.toString(), c.count));

  let savedPostSet = new Set();
  let userVoteMap = new Map();

  if (currentUserId) {
    const saved = await SavedPost.find({
      user: currentUserId,
      post: { $in: postIds },
    }).select("post");
    savedPostSet = new Set(saved.map((s) => s.post.toString()));

    const userVotes = await Vote.find({
      user: currentUserId,
      targetType: "Post",
      targetId: { $in: postIds },
    });
    userVotes.forEach((v) => {
      userVoteMap.set(v.targetId.toString(), v.value === 1 ? "upvote" : "downvote");
    });
  }

  return posts.map((post) => {
    const doc = post.toObject ? post.toObject() : { ...post };
    const authorId = doc.user?._id?.toString() || doc.user?.toString();
    const postIdStr = doc._id.toString();
    const reactCount = doc.reactCount || { upvote: 0, downvote: 0 };

    return {
      _id: doc._id,
      heading: doc.heading,
      description: doc.description,
      imageLink: doc.imageLink,
      user: {
        _id: doc.user?._id || doc.user,
        username: doc.user?.username || "",
        imageLink: authorId ? avatarMap.get(authorId) || "" : "",
      },
      group: doc.group,
      commentsCount: commentCountMap.get(postIdStr) || 0,
      isSaved: savedPostSet.has(postIdStr),
      isOwner: currentUserId && authorId ? authorId === currentUserId : false,
      reactCount,
      reactcount: reactCount,
      userReaction: userVoteMap.get(postIdStr) || null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  });
}

// GET /api/posts
// List posts across groups (respects privacy, supports pagination)
export async function getFeed(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const currentUserId = req.user?.id;

    // Filter groups visible to requester
    const groupFilter = currentUserId
      ? {
          $or: [
            { privacy: "public" },
            { members: currentUserId },
            { creator: currentUserId },
          ],
        }
      : { privacy: "public" };

    const visibleGroups = await Group.find(groupFilter).select("_id");
    const visibleGroupIds = visibleGroups.map((g) => g._id);

    const totalPosts = await Post.countDocuments({
      group: { $in: visibleGroupIds },
    });

    const posts = await Post.find({ group: { $in: visibleGroupIds } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "username")
      .populate("group", "name category groupIconLink privacy");

    const formatted = await batchFormatPosts(posts, currentUserId);

    return SuccessHandler(
      {
        posts: formatted,
        count: formatted.length,
        totalPosts,
        totalPages: Math.ceil(totalPosts / limit) || 1,
        currentPage: page,
      },
      res,
      200,
      "Feed posts fetched successfully",
      "post-service",
    );
  } catch (error) {
    next(error);
  }
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
      .populate("group", "name category groupIconLink privacy");

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
      .populate("group", "name category groupIconLink privacy members creator");

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
      .populate("group", "name category groupIconLink privacy");

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

// POST /api/posts/:id/save
// Toggle bookmark / saved status of a post
export async function toggleSavePost(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ErrorHandler(res, 400, "Invalid post ID", undefined, "post-service");
    }

    const post = await Post.findById(id);
    if (!post) {
      return ErrorHandler(res, 404, "Post not found", undefined, "post-service");
    }

    const existingSave = await SavedPost.findOne({
      user: req.user.id,
      post: id,
    });

    if (existingSave) {
      await SavedPost.findByIdAndDelete(existingSave._id);
      return SuccessHandler(
        { postId: id, saved: false },
        res,
        200,
        "Post removed from saved posts",
        "post-service",
      );
    } else {
      try {
        await SavedPost.create({ user: req.user.id, post: id });
        return SuccessHandler(
          { postId: id, saved: true },
          res,
          200,
          "Post saved successfully",
          "post-service",
        );
      } catch (err) {
        if (err.code === 11000) {
          return SuccessHandler(
            { postId: id, saved: true },
            res,
            200,
            "Post saved successfully",
            "post-service",
          );
        }
        throw err;
      }
    }
  } catch (error) {
    next(error);
  }
}

// GET /api/saved (and GET /api/posts/saved)
// Get paginated list of posts saved by the authenticated user
export async function getSavedPosts(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const totalPosts = await SavedPost.countDocuments({ user: req.user.id });

    const savedEntries = await SavedPost.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "post",
        populate: [
          { path: "user", select: "username" },
          { path: "group", select: "name category groupIconLink privacy" },
        ],
      });

    const validPosts = savedEntries.map((s) => s.post).filter(Boolean);
    const formatted = await batchFormatPosts(validPosts, req.user.id);

    // Ensure isSaved is explicitly true for all saved posts
    formatted.forEach((p) => {
      p.isSaved = true;
    });

    return SuccessHandler(
      {
        posts: formatted,
        count: formatted.length,
        totalPosts,
        totalPages: Math.ceil(totalPosts / limit) || 1,
        currentPage: page,
      },
      res,
      200,
      "Saved posts fetched successfully",
      "post-service",
    );
  } catch (error) {
    next(error);
  }
}

// GET /api/groups/:idOrName/posts
// Get paginated feed of posts for a specific group (checks group privacy)
export async function getGroupPosts(req, res, next) {
  try {
    const { idOrName } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const cleanIdentifier = sanitizeGroupName(idOrName);
    const isObjectId = mongoose.Types.ObjectId.isValid(idOrName);

    const group = await Group.findOne(
      isObjectId
        ? { $or: [{ _id: idOrName }, { name: cleanIdentifier }] }
        : { name: cleanIdentifier },
    );

    if (!group) {
      return ErrorHandler(res, 404, "Group not found", undefined, "post-service");
    }

    const currentUserId = req.user?.id;
    if (group.privacy === "private") {
      const isMember = currentUserId
        ? group.members.some((m) => m.toString() === currentUserId)
        : false;
      const isCreator = currentUserId
        ? group.creator.toString() === currentUserId
        : false;

      if (!isMember && !isCreator) {
        return ErrorHandler(
          res,
          403,
          "This group is private. You must be an accepted member to view its posts.",
          undefined,
          "post-service",
        );
      }
    }

    const totalPosts = await Post.countDocuments({ group: group._id });

    const posts = await Post.find({ group: group._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "username")
      .populate("group", "name category groupIconLink privacy");

    const formatted = await batchFormatPosts(posts, currentUserId);

    return SuccessHandler(
      {
        posts: formatted,
        count: formatted.length,
        totalPosts,
        totalPages: Math.ceil(totalPosts / limit) || 1,
        currentPage: page,
        group: {
          _id: group._id,
          name: group.name,
          privacy: group.privacy,
        },
      },
      res,
      200,
      "Group posts fetched successfully",
      "post-service",
    );
  } catch (error) {
    next(error);
  }
}

// POST /api/posts/:id/react (or POST /api/posts/:id/vote)
// Toggle, add, or switch user reaction (upvote / downvote) on a post
export async function reactPost(req, res, next) {
  try {
    const { id } = req.params;
    const rawType =
      req.body.reaction ??
      req.body.type ??
      req.body.action ??
      (req.body.value === 1 || req.body.vote === 1
        ? "upvote"
        : req.body.value === -1 || req.body.vote === -1
        ? "downvote"
        : req.body.value ?? req.body.vote);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ErrorHandler(res, 400, "Invalid post ID", undefined, "post-service");
    }

    if (!rawType || typeof rawType !== "string") {
      return ErrorHandler(
        res,
        400,
        "Reaction type is required. Expected: 'upvote' or 'downvote'",
        undefined,
        "post-service",
      );
    }

    const reaction = rawType.trim().toLowerCase();
    if (reaction !== "upvote" && reaction !== "downvote") {
      return ErrorHandler(
        res,
        400,
        "Invalid reaction type. Supported reactions: 'upvote', 'downvote'",
        undefined,
        "post-service",
      );
    }

    const post = await Post.findById(id);
    if (!post) {
      return ErrorHandler(res, 404, "Post not found", undefined, "post-service");
    }

    if (!post.reactCount) {
      post.reactCount = { upvote: 0, downvote: 0 };
    }

    const userId = req.user.id;
    const targetValue = reaction === "upvote" ? 1 : -1;

    const existingVote = await Vote.findOne({
      user: userId,
      targetType: "Post",
      targetId: id,
    });

    let userReaction = null;
    let actionMessage = "";

    if (!existingVote) {
      // 1. New reaction
      await Vote.create({
        user: userId,
        targetType: "Post",
        targetId: id,
        value: targetValue,
      });

      if (targetValue === 1) {
        post.reactCount.upvote = (post.reactCount.upvote || 0) + 1;
        await UserProfile.findOneAndUpdate(
          { user: userId },
          { $addToSet: { likedPosts: post._id } },
        );
        actionMessage = "Post upvoted successfully";
      } else {
        post.reactCount.downvote = (post.reactCount.downvote || 0) + 1;
        actionMessage = "Post downvoted successfully";
      }
      userReaction = reaction;
    } else if (existingVote.value === targetValue) {
      // 2. Toggle off existing reaction
      await Vote.findByIdAndDelete(existingVote._id);

      if (targetValue === 1) {
        post.reactCount.upvote = Math.max(0, (post.reactCount.upvote || 0) - 1);
        await UserProfile.findOneAndUpdate(
          { user: userId },
          { $pull: { likedPosts: post._id } },
        );
      } else {
        post.reactCount.downvote = Math.max(0, (post.reactCount.downvote || 0) - 1);
      }
      userReaction = null;
      actionMessage = "Reaction removed successfully";
    } else {
      // 3. Switch reaction
      existingVote.value = targetValue;
      await existingVote.save();

      if (targetValue === 1) {
        // Switched from downvote to upvote
        post.reactCount.downvote = Math.max(0, (post.reactCount.downvote || 0) - 1);
        post.reactCount.upvote = (post.reactCount.upvote || 0) + 1;
        await UserProfile.findOneAndUpdate(
          { user: userId },
          { $addToSet: { likedPosts: post._id } },
        );
        actionMessage = "Reaction changed to upvote";
      } else {
        // Switched from upvote to downvote
        post.reactCount.upvote = Math.max(0, (post.reactCount.upvote || 0) - 1);
        post.reactCount.downvote = (post.reactCount.downvote || 0) + 1;
        await UserProfile.findOneAndUpdate(
          { user: userId },
          { $pull: { likedPosts: post._id } },
        );
        actionMessage = "Reaction changed to downvote";
      }
      userReaction = reaction;
    }

    await post.save();

    return SuccessHandler(
      {
        postId: post._id,
        userReaction,
        reactCount: post.reactCount,
        reactcount: post.reactCount,
      },
      res,
      200,
      actionMessage,
      "post-service",
    );
  } catch (error) {
    next(error);
  }
}

// GET /api/posts/:id/react (or GET /api/posts/:id/vote)
// Get post reaction counts and current user's reaction
export async function getPostReaction(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ErrorHandler(res, 400, "Invalid post ID", undefined, "post-service");
    }

    const post = await Post.findById(id);
    if (!post) {
      return ErrorHandler(res, 404, "Post not found", undefined, "post-service");
    }

    let userReaction = null;
    if (req.user?.id) {
      const userVote = await Vote.findOne({
        user: req.user.id,
        targetType: "Post",
        targetId: id,
      });
      if (userVote) {
        userReaction = userVote.value === 1 ? "upvote" : "downvote";
      }
    }

    const reactCount = post.reactCount || { upvote: 0, downvote: 0 };
    return SuccessHandler(
      {
        postId: post._id,
        reactCount,
        reactcount: reactCount,
        userReaction,
      },
      res,
      200,
      "Reaction status fetched successfully",
      "post-service",
    );
  } catch (error) {
    next(error);
  }
}

