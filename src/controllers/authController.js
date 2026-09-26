import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/Users.js";
import UserProfile from "../models/UserProfile.js";
import { SuccessHandler } from "../util/successHandler.js";
import { ErrorHandler } from "../util/errorHandler.js";
import {
  COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
  CLEAR_COOKIE_OPTIONS,
  CLEAR_REFRESH_COOKIE_OPTIONS,
  generateAccessToken,
  generateRefreshToken,
} from "../util/authHelper.js";

// POST /register
export async function register(req, res, next) {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return ErrorHandler(res, 400, "Username, email, and password are required");
    }

    const existingUser = await User.findOne({
      $or: [
        { username: username.trim() },
        { email: email.trim().toLowerCase() },
      ],
    });

    if (existingUser) {
      return ErrorHandler(res, 400, "Username or email already exists");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
    });

    // Create default profile for new user
    await UserProfile.create({
      user: user._id,
      imageLink: "",
      bio: "",
    });

    // Clear any prior or stale session cookies
    res.clearCookie("accessToken", CLEAR_COOKIE_OPTIONS);
    res.clearCookie("refreshToken", CLEAR_REFRESH_COOKIE_OPTIONS);

    return SuccessHandler(
      {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
      },
      res,
      201,
      "User registered successfully",
    );
  } catch (error) {
    next(error);
  }
}

// POST /login
export async function login(req, res, next) {
  try {
    const { username, email, identifier, password } = req.body;
    const loginId = (identifier || email || username)?.trim();

    if (!loginId || !password) {
      return ErrorHandler(res, 400, "Username/Email and password are required");
    }

    const user = await User.findOne({
      $or: [
        { username: loginId },
        { email: loginId.toLowerCase() },
      ],
    }).select("+password");

    if (!user) {
      return ErrorHandler(res, 401, "Invalid credentials");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return ErrorHandler(res, 401, "Invalid credentials");
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie("accessToken", accessToken, COOKIE_OPTIONS);
    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

    return SuccessHandler(
      {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
        accessToken,
        refreshToken,
      },
      res,
      200,
      "Logged in successfully",
    );
  } catch (error) {
    next(error);
  }
}

// POST /logout
export function logout(req, res) {
  res.clearCookie("accessToken", CLEAR_COOKIE_OPTIONS);
  res.clearCookie("refreshToken", CLEAR_REFRESH_COOKIE_OPTIONS);

  return SuccessHandler(null, res, 200, "Logged out successfully");
}

// GET /me
export async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return ErrorHandler(res, 404, "User not found");
    }

    // Get or create profile
    let profile = await UserProfile.findOne({ user: user._id }).populate(
      "groups",
      "name category tagline groupIconLink bannerLink privacy",
    );

    if (!profile) {
      profile = await UserProfile.create({
        user: user._id,
        imageLink: "",
        bio: "",
      });
      profile = await UserProfile.findById(profile._id).populate(
        "groups",
        "name category tagline groupIconLink bannerLink privacy",
      );
    }

    return SuccessHandler(
      {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
        profile: {
          imageLink: profile.imageLink,
          bio: profile.bio,
          groups: profile.groups,
        },
      },
      res,
      200,
      "User fetched successfully",
    );
  } catch (error) {
    next(error);
  }
}

// POST /refresh
export async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return ErrorHandler(res, 401, "Refresh token required");
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      res.clearCookie("accessToken", CLEAR_COOKIE_OPTIONS);
      res.clearCookie("refreshToken", CLEAR_REFRESH_COOKIE_OPTIONS);
      return ErrorHandler(res, 401, "Invalid or expired refresh token", err);
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      res.clearCookie("accessToken", CLEAR_COOKIE_OPTIONS);
      res.clearCookie("refreshToken", CLEAR_REFRESH_COOKIE_OPTIONS);
      return ErrorHandler(res, 401, "User not found");
    }

    // Stateful revocation check via tokenVersion
    if (decoded.tokenVersion !== undefined && user.tokenVersion !== undefined) {
      if (decoded.tokenVersion !== user.tokenVersion) {
        res.clearCookie("accessToken", CLEAR_COOKIE_OPTIONS);
        res.clearCookie("refreshToken", CLEAR_REFRESH_COOKIE_OPTIONS);
        return ErrorHandler(res, 401, "Refresh token has been revoked");
      }
    }

    // Refresh token rotation: issue new access token and rotate refresh token
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.cookie("accessToken", newAccessToken, COOKIE_OPTIONS);
    res.cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS);

    return SuccessHandler(
      {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
      },
      res,
      200,
      "Token refreshed successfully",
    );
  } catch (error) {
    next(error);
  }
}


