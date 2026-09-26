import { Vote } from "../models/Vote.js";
import { Comment } from "../models/Comment.js";
import { UserProfile } from "../models/UserProfile.js";
import { SuccessHandler } from "../util/successHandler.js";
import { ErrorHandler } from "../util/errorHandler.js";

export async function voteComment(req, res, next) {
  try {
    const { commentId } = req.params;
    const { value } = req.body;

    if (![1, -1].includes(value)) {
      return ErrorHandler(res, 400, "Vote value must be 1 (upvote) or -1 (downvote)");
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return ErrorHandler(res, 404, "Comment not found");
    }

    const userId = req.user.id;
    const userIdStr = userId.toString();

    // Check if user already voted on this comment
    const existingVoteIndex = comment.votedBy.findIndex(
      (v) => {
        const voterId = v.user?._id?.toString?.() || v.user?.toString?.();
        return voterId === userIdStr;
      }
    );

    let newVoteValue = value;
    let message = "";

    if (existingVoteIndex !== -1) {
      const existingVote = comment.votedBy[existingVoteIndex];
      if (existingVote.value === value) {
        // Remove vote (toggle off)
        comment.votedBy.splice(existingVoteIndex, 1);
        newVoteValue = 0;
        message = value === 1 ? "Upvote removed" : "Downvote removed";
      } else {
        // Change vote
        existingVote.value = value;
        newVoteValue = value;
        message = value === 1 ? "Upvoted" : "Downvoted";
      }
    } else {
      // New vote
      comment.votedBy.push({ user: userId, value });
      newVoteValue = value;
      message = value === 1 ? "Upvoted" : "Downvoted";
    }

    // Recalculate counts
    comment.upvotes = comment.votedBy.filter((v) => v.value === 1).length;
    comment.downvotes = comment.votedBy.filter((v) => v.value === -1).length;
    comment.score = comment.upvotes - comment.downvotes;

    await comment.save();

    // Also sync with Vote collection for backward compatibility
    const existingVote = await Vote.findOne({
      user: userId,
      targetType: "Comment",
      targetId: commentId,
    });

    if (existingVote) {
      if (existingVote.value === value) {
        await Vote.findByIdAndDelete(existingVote._id);
      } else {
        existingVote.value = value;
        await existingVote.save();
      }
    } else if (newVoteValue !== 0) {
      await Vote.create({
        user: userId,
        targetType: "Comment",
        targetId: commentId,
        value: newVoteValue,
      });
    }

    // Sync with UserProfile likedComments (like posts do with likedPosts)
    if (newVoteValue === 1) {
      // Upvoted - add to likedComments
      await UserProfile.findOneAndUpdate(
        { user: userId },
        { $addToSet: { likedComments: commentId } },
      );
    } else if (newVoteValue === 0 && value === 1) {
      // Removed upvote - remove from likedComments
      await UserProfile.findOneAndUpdate(
        { user: userId },
        { $pull: { likedComments: commentId } },
      );
    } else if (newVoteValue === -1 && value === -1) {
      // Changed from upvote to downvote - remove from likedComments
      await UserProfile.findOneAndUpdate(
        { user: userId },
        { $pull: { likedComments: commentId } },
      );
    } else if (newVoteValue === 1 && value === 1 && existingVoteIndex !== -1) {
      // Changed from downvote to upvote - add to likedComments
      await UserProfile.findOneAndUpdate(
        { user: userId },
        { $addToSet: { likedComments: commentId } },
      );
    }

    return SuccessHandler(
      { score: comment.score, upvotes: comment.upvotes, downvotes: comment.downvotes, userVote: newVoteValue },
      res,
      200,
      message,
    );
  } catch (error) {
    next(error);
  }
}

export async function getCommentVotes(req, res, next) {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return ErrorHandler(res, 404, "Comment not found");
    }

    let userVote = 0;
    if (req.user?.id) {
      const userIdStr = req.user.id.toString();
      const vote = comment.votedBy.find(
        (v) => {
          const voterId = v.user?._id?.toString?.() || v.user?.toString?.();
          return voterId === userIdStr;
        }
      );
      if (vote) userVote = vote.value;
    }

    return SuccessHandler(
      { score: comment.score, upvotes: comment.upvotes, downvotes: comment.downvotes, userVote },
      res,
      200,
      "Comment votes fetched",
    );
  } catch (error) {
    next(error);
  }
}

export async function getCommentVotesBatch(req, res, next) {
  try {
    const { commentIds } = req.body;

    if (!Array.isArray(commentIds) || commentIds.length === 0) {
      return SuccessHandler({}, res, 200, "No comment IDs provided");
    }

    const comments = await Comment.find({ _id: { $in: commentIds } }).select(
      "upvotes downvotes score votedBy",
    );

    const voteMap = {};
    comments.forEach((c) => {
      let userVote = 0;
      if (req.user?.id) {
        const userIdStr = req.user.id.toString();
        const vote = c.votedBy.find(
          (v) => {
            const voterId = v.user?._id?.toString?.() || v.user?.toString?.();
            return voterId === userIdStr;
          }
        );
        if (vote) userVote = vote.value;
      }
      voteMap[c._id.toString()] = {
        upvotes: c.upvotes,
        downvotes: c.downvotes,
        score: c.score,
        userVote,
      };
    });

    commentIds.forEach((id) => {
      if (!voteMap[id]) voteMap[id] = { upvotes: 0, downvotes: 0, userVote: 0, score: 0 };
    });

    return SuccessHandler(voteMap, res, 200, "Comment votes batch fetched");
  } catch (error) {
    next(error);
  }
}