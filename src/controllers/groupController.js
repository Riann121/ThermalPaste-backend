import mongoose from "mongoose";
import { Group } from "../models/Group.js";
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

// POST /api/groups
// Create a new group (creator automatically becomes the first member)
export async function createGroup(req, res, next) {
  try {
    const {
      name,
      tagline,
      description,
      category,
      privacy,
      groupIconLink,
      bannerLink,
    } = req.body;

    const cleanName = sanitizeGroupName(name);
    if (!cleanName) {
      return ErrorHandler(
        res,
        400,
        "Group name is required (letters, numbers, hyphens, and underscores only)",
      );
    }

    // Check uniqueness
    const existing = await Group.findOne({ name: cleanName });
    if (existing) {
      return ErrorHandler(
        res,
        409,
        `Group 'g/${cleanName}' already exists. Please choose a different name.`,
      );
    }

    const validPrivacy = privacy === "private" ? "private" : "public";

    const newGroup = await Group.create({
      name: cleanName,
      tagline: tagline?.trim() || "",
      description: description?.trim() || "",
      category: category?.trim() || "hardware",
      privacy: validPrivacy,
      groupIconLink: groupIconLink?.trim() || "",
      bannerLink: bannerLink?.trim() || "",
      creator: req.user.id,
      members: [req.user.id],
      joinRequests: [],
    });

    const populated = await newGroup.populate("creator", "username email");

    return SuccessHandler(
      { group: populated },
      res,
      201,
      "Group created successfully",
    );
  } catch (error) {
    next(error);
  }
}

// GET /api/groups
// List public groups (and private groups user already belongs to), supports search & category filters
export async function getGroups(req, res, next) {
  try {
    const { search, category } = req.query;
    const currentUserId = req.user?.id;

    // Filter conditions:
    // Show public groups; or private groups where the user is an active member or creator
    const visibilityFilter = currentUserId
      ? {
          $or: [
            { privacy: "public" },
            { members: currentUserId },
            { creator: currentUserId },
          ],
        }
      : { privacy: "public" };

    const query = { ...visibilityFilter };

    if (category && category.trim()) {
      query.category = category.trim();
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$and = [
        {
          $or: [
            { name: searchRegex },
            { tagline: searchRegex },
            { description: searchRegex },
          ],
        },
      ];
    }

    const groups = await Group.find(query)
      .populate("creator", "username")
      .sort({ createdAt: -1 });

    const formatted = groups.map((g) => {
      const doc = g.toObject();
      const isMember = currentUserId
        ? g.members.some((m) => m.toString() === currentUserId)
        : false;
      const isCreator = currentUserId
        ? g.creator?._id?.toString() === currentUserId
        : false;
      const isPending = currentUserId
        ? g.joinRequests.some((r) => r.toString() === currentUserId)
        : false;

      return {
        _id: doc._id,
        name: doc.name,
        tagline: doc.tagline,
        description: doc.description,
        category: doc.category,
        privacy: doc.privacy,
        groupIconLink: doc.groupIconLink,
        bannerLink: doc.bannerLink,
        creator: doc.creator,
        membersCount: doc.members?.length || 0,
        isMember,
        isCreator,
        isPending,
        createdAt: doc.createdAt,
      };
    });

    return SuccessHandler(
      { groups: formatted, count: formatted.length },
      res,
      200,
      "Groups fetched successfully",
    );
  } catch (error) {
    next(error);
  }
}

// GET /api/groups/:idOrName
// Fetch group details by MongoDB _id OR slug name
export async function getGroupByIdOrName(req, res, next) {
  try {
    const { idOrName } = req.params;
    const cleanIdentifier = sanitizeGroupName(idOrName);
    const isObjectId = mongoose.Types.ObjectId.isValid(idOrName);

    const group = await Group.findOne(
      isObjectId
        ? { $or: [{ _id: idOrName }, { name: cleanIdentifier }] }
        : { name: cleanIdentifier },
    ).populate("creator", "username email");

    if (!group) {
      return ErrorHandler(res, 404, "Group not found");
    }

    const currentUserId = req.user?.id;
    const isCreator = currentUserId
      ? group.creator?._id?.toString() === currentUserId
      : false;
    const isMember = currentUserId
      ? group.members.some((m) => m.toString() === currentUserId)
      : false;
    const isPending = currentUserId
      ? group.joinRequests.some((r) => r.toString() === currentUserId)
      : false;

    const hasAccess = group.privacy === "public" || isMember || isCreator;

    return SuccessHandler(
      {
        group: {
          _id: group._id,
          name: group.name,
          tagline: group.tagline,
          description: group.description,
          category: group.category,
          privacy: group.privacy,
          groupIconLink: group.groupIconLink,
          bannerLink: group.bannerLink,
          creator: group.creator,
          membersCount: group.members.length,
          isCreator,
          isMember,
          isPending,
          hasAccess,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
        },
      },
      res,
      200,
      "Group details fetched successfully",
    );
  } catch (error) {
    next(error);
  }
}

// PATCH /api/groups/:id
// Update group settings (Creator only, no delete operation)
export async function updateGroup(req, res, next) {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);

    if (!group) {
      return ErrorHandler(res, 404, "Group not found");
    }

    if (group.creator.toString() !== req.user.id) {
      return ErrorHandler(
        res,
        403,
        "Permission denied: Only the group creator can update this group",
      );
    }

    const allowedUpdates = [
      "tagline",
      "description",
      "category",
      "privacy",
      "groupIconLink",
      "bannerLink",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "privacy") {
          group.privacy = req.body[field] === "private" ? "private" : "public";
        } else {
          group[field] = req.body[field];
        }
      }
    });

    await group.save();
    const populated = await group.populate("creator", "username email");

    return SuccessHandler(
      { group: populated },
      res,
      200,
      "Group updated successfully",
    );
  } catch (error) {
    next(error);
  }
}

// POST /api/groups/:id/join
// Join a public group immediately, or submit a join request for a private group
export async function joinGroup(req, res, next) {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);

    if (!group) {
      return ErrorHandler(res, 404, "Group not found");
    }

    const userId = req.user.id;

    // Already a member?
    if (group.members.some((m) => m.toString() === userId)) {
      return ErrorHandler(res, 400, "You are already a member of this group");
    }

    // Public group: join immediately
    if (group.privacy === "public") {
      group.members.push(userId);
      // Remove from pending requests if previously applied
      group.joinRequests = group.joinRequests.filter(
        (r) => r.toString() !== userId,
      );
      await group.save();

      return SuccessHandler(
        { status: "active", membersCount: group.members.length },
        res,
        200,
        "Joined group successfully",
      );
    }

    // Private group: create a pending join request
    if (group.joinRequests.some((r) => r.toString() === userId)) {
      return ErrorHandler(
        res,
        400,
        "You already have a pending join request for this group",
      );
    }

    group.joinRequests.push(userId);
    await group.save();

    return SuccessHandler(
      { status: "pending" },
      res,
      200,
      "Join request submitted. Awaiting approval from the group creator.",
    );
  } catch (error) {
    next(error);
  }
}

// POST /api/groups/:id/leave
// Leave a group (Creator cannot leave their own group)
export async function leaveGroup(req, res, next) {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);

    if (!group) {
      return ErrorHandler(res, 404, "Group not found");
    }

    const userId = req.user.id;

    if (group.creator.toString() === userId) {
      return ErrorHandler(
        res,
        400,
        "The group creator cannot leave the group.",
      );
    }

    const isMember = group.members.some((m) => m.toString() === userId);
    if (!isMember) {
      return ErrorHandler(res, 400, "You are not a member of this group");
    }

    group.members = group.members.filter((m) => m.toString() !== userId);
    await group.save();

    return SuccessHandler(
      { membersCount: group.members.length },
      res,
      200,
      "Left group successfully",
    );
  } catch (error) {
    next(error);
  }
}

// GET /api/groups/:id/requests
// Get pending join requests for a private group (Creator only)
export async function getJoinRequests(req, res, next) {
  try {
    const { id } = req.params;
    const group = await Group.findById(id).populate(
      "joinRequests",
      "username email",
    );

    if (!group) {
      return ErrorHandler(res, 404, "Group not found");
    }

    if (group.creator.toString() !== req.user.id) {
      return ErrorHandler(
        res,
        403,
        "Permission denied: Only the group creator can view join requests",
      );
    }

    return SuccessHandler(
      { requests: group.joinRequests, count: group.joinRequests.length },
      res,
      200,
      "Join requests fetched successfully",
    );
  } catch (error) {
    next(error);
  }
}

// PATCH /api/groups/:id/requests/:userId
// Accept or reject a user's join request (Creator only)
// Body: { action: "accept" | "reject" }
export async function handleJoinRequest(req, res, next) {
  try {
    const { id, userId } = req.params;
    const { action } = req.body;

    if (!["accept", "reject"].includes(action)) {
      return ErrorHandler(
        res,
        400,
        "Invalid action: must be 'accept' or 'reject'",
      );
    }

    const group = await Group.findById(id);
    if (!group) {
      return ErrorHandler(res, 404, "Group not found");
    }

    if (group.creator.toString() !== req.user.id) {
      return ErrorHandler(
        res,
        403,
        "Permission denied: Only the group creator can manage join requests",
      );
    }

    const hasRequest = group.joinRequests.some((r) => r.toString() === userId);
    if (!hasRequest) {
      return ErrorHandler(res, 404, "No pending request found for this user");
    }

    // Remove from join requests queue
    group.joinRequests = group.joinRequests.filter(
      (r) => r.toString() !== userId,
    );

    if (action === "accept") {
      // Add to members if not already present
      if (!group.members.some((m) => m.toString() === userId)) {
        group.members.push(userId);
      }
      await group.save();

      return SuccessHandler(
        { userId, action: "accepted", membersCount: group.members.length },
        res,
        200,
        "User accepted into the group",
      );
    } else {
      await group.save();
      return SuccessHandler(
        { userId, action: "rejected" },
        res,
        200,
        "Join request rejected",
      );
    }
  } catch (error) {
    next(error);
  }
}
