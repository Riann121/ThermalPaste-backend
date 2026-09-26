import { UserProfile } from "../models/UserProfile.js";
import { User } from "../models/Users.js";
import { SuccessHandler } from "../util/successHandler.js";
import { ErrorHandler } from "../util/errorHandler.js";
import cloudinary from "../config/cloudinary.js";

const ALLOWED_FIELDS = [
  "imageLink",
  "bio",
  "storage",
  "groups",
  "likedPosts",
  "likedComments",
  "comments",
];

export async function createProfile(req, res, next) {
  try {
    const existing = await UserProfile.findOne({ user: req.user.id });
    if (existing) {
      return ErrorHandler(
        res,
        409,
        "Profile already exists, use update instead",
      );
    }

    const data = {};
    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }

    const created = await UserProfile.create({ ...data, user: req.user.id });
    const profile = await UserProfile.findById(created._id)
      .populate("user", "username email")
      .populate("groups", "name category tagline groupIconLink bannerLink privacy");

    return SuccessHandler(
      { profile },
      res,
      201,
      "Profile created successfully",
    );
  } catch (error) {
    next(error);
  }
}

export async function getProfile(req, res, next) {
  try {
    let profile = await UserProfile.findOne({ user: req.user.id })
      .populate("user", "username email")
      .populate("groups", "name category tagline groupIconLink bannerLink privacy");

    // Auto-create default profile if not exists
    if (!profile) {
      const user = await User.findById(req.user.id).select("username email");
      if (!user) {
        return ErrorHandler(res, 404, "User not found");
      }

      profile = await UserProfile.create({
        user: user._id,
        imageLink: "",
        bio: "",
      });

      // Populate the newly created profile
      profile = await UserProfile.findById(profile._id)
        .populate("user", "username email")
        .populate("groups", "name category tagline groupIconLink bannerLink privacy");
    }

    return SuccessHandler(
      { profile },
      res,
      200,
      "Profile fetched successfully",
    );
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const updates = {};
    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const profile = await UserProfile.findOneAndUpdate(
      { user: req.user.id },
      { $set: updates },
      { new: true, runValidators: true },
    )
      .populate("user", "username email")
      .populate("groups", "name category tagline groupIconLink bannerLink privacy");

    if (!profile) {
      return ErrorHandler(
        res,
        404,
        "Profile not found, create it first",
      );
    }

    return SuccessHandler(
      { profile },
      res,
      200,
      "Profile updated successfully",
    );
  } catch (error) {
    next(error);
  }
}

export async function deleteProfile(req, res, next) {
  try {
    const profile = await UserProfile.findOneAndDelete({ user: req.user.id });
    if (!profile) {
      return ErrorHandler(res, 404, "Profile not found");
    }

    return SuccessHandler(
      null,
      res,
      200,
      "Profile deleted successfully",
    );
  } catch (error) {
    next(error);
  }
}

export async function uploadProfileImage(req, res, next) {
  try {
    if (!req.file) {
      return ErrorHandler(res, 400, "No image file provided");
    }

    const imageUrl = req.file.path;

    const profile = await UserProfile.findOneAndUpdate(
      { user: req.user.id },
      { $set: { imageLink: imageUrl } },
      { new: true, runValidators: true },
    )
      .populate("user", "username email")
      .populate("groups", "name category tagline groupIconLink bannerLink privacy");

    if (!profile) {
      return ErrorHandler(res, 404, "Profile not found");
    }

    return SuccessHandler(
      { profile },
      res,
      200,
      "Profile image uploaded successfully",
    );
  } catch (error) {
    next(error);
  }
}