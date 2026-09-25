import { Comment } from "../models/Comment.js";
import { SuccessHandler } from "../util/successHandler.js";
import { ErrorHandler } from "../util/errorHandler.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Recursively builds a nested comment tree from a flat array.
function buildTree(comments) {
  const map = new Map();
  const roots = [];

  comments.forEach((c) => {
    const doc = c.toObject ? c.toObject() : { ...c };
    doc.replies = [];
    map.set(doc._id.toString(), doc);
  });

  comments.forEach((c) => {
    const doc = map.get(c._id.toString());
    if (doc.parentComment) {
      const parent = map.get(doc.parentComment.toString());
      if (parent) {
        parent.replies.push(doc);
      }
    } else {
      roots.push(doc);
    }
  });

  return roots;
}

// ─── Controllers ───────────────────────────────────────────────────────────────

// POST /api/comments
// Creates a top-level comment or a reply to an existing comment.
// Body: { postId, parentCommentId (optional), comment }
export async function createComment(req, res, next) {
  try {
    const { postId, parentCommentId, comment } = req.body;

    if (!postId) {
      return ErrorHandler(res, 400, "postId is required");
    }

    if (!comment || !comment.trim()) {
      return ErrorHandler(res, 400, "Comment text is required");
    }

    let resolvedParent = null;
    if (parentCommentId) {
      resolvedParent = await Comment.findById(parentCommentId);
      if (!resolvedParent) {
        return ErrorHandler(res, 404, "Parent comment not found");
      }
      // Ensure the parent belongs to the same post (no orphaned replies)
      if (resolvedParent.post.toString() !== postId) {
        return ErrorHandler(res, 400, "Parent comment does not belong to this post");
      }
    }

    const newComment = await Comment.create({
      user: req.user.id,
      post: postId,
      parentComment: parentCommentId || null,
      comment: comment.trim(),
    });

    const populated = await newComment.populate("user", "username");

    return SuccessHandler(
      { comment: populated },
      res,
      201,
      resolvedParent ? "Reply created successfully" : "Comment created successfully",
    );
  } catch (error) {
    next(error);
  }
}

// GET /api/posts/:postId/comments
// Returns all comments for a post as a nested tree (replies under parent).
export async function getComments(req, res, next) {
  try {
    const { postId } = req.params;

    const flat = await Comment.find({ post: postId })
      .populate("user", "username")
      .populate("likes", "username")
      .sort({ createdAt: 1 });

    const tree = buildTree(flat);

    return SuccessHandler(
      { comments: tree, count: flat.length },
      res,
      200,
      "Comments fetched successfully",
    );
  } catch (error) {
    next(error);
  }
}

// PUT /api/comments/:commentId
// Updates a comment owned by the current user.
// Body: { comment }
export async function updateComment(req, res, next) {
  try {
    const { commentId } = req.params;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return ErrorHandler(res, 400, "Comment text is required");
    }

    const existing = await Comment.findOne({ _id: commentId, user: req.user.id });
    if (!existing) {
      return ErrorHandler(res, 403, "You can only edit your own comments");
    }

    existing.comment = comment.trim();
    await existing.save();

    const populated = await existing.populate("user", "username");

    return SuccessHandler(
      { comment: populated },
      res,
      200,
      "Comment updated successfully",
    );
  } catch (error) {
    next(error);
  }
}

// DELETE /api/comments/:commentId
// Deletes a comment owned by the current user.
// Also deletes all descendant replies (cascade).
export async function deleteComment(req, res, next) {
  try {
    const { commentId } = req.params;

    const existing = await Comment.findOneAndDelete({
      _id: commentId,
      user: req.user.id,
    });

    if (!existing) {
      return ErrorHandler(res, 403, "You can only delete your own comments");
    }

    // Cascade-delete all replies to this comment
    await Comment.deleteMany({ parentComment: commentId });

    return SuccessHandler(
      null,
      res,
      200,
      "Comment and its replies deleted successfully",
    );
  } catch (error) {
    next(error);
  }
}

// POST /api/comments/:commentId/like
// Toggles the current user's like on a comment.
export async function likeComment(req, res, next) {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return ErrorHandler(res, 404, "Comment not found");
    }

    const userIdStr = req.user.id;
    const alreadyLiked = comment.likes.some(
      (id) => id.toString() === userIdStr,
    );

    if (alreadyLiked) {
      comment.likes.pull(userIdStr);
      await comment.save();
      return SuccessHandler(
        { comment, liked: false },
        res,
        200,
        "Like removed",
      );
    } else {
      comment.likes.push(userIdStr);
      await comment.save();
      const populated = await comment.populate("likes", "username");
      return SuccessHandler(
        { comment: populated, liked: true },
        res,
        200,
        "Comment liked",
      );
    }
  } catch (error) {
    next(error);
  }
}
