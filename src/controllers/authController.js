import bcrypt from "bcryptjs";
import User from "../models/Users.js";
import { SuccessHandler } from "../util/successHandler.js";
import { ErrorHandler } from "../util/errorHandler.js";
import { COOKIE_OPTIONS, generateToken } from "../util/authHelper.js";

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

    const token = generateToken(user);
    res.cookie("token", token, COOKIE_OPTIONS);

    return SuccessHandler(
      {
        token,
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
    });

    if (!user) {
      return ErrorHandler(res, 401, "Invalid credentials");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return ErrorHandler(res, 401, "Invalid credentials");
    }

    const token = generateToken(user);
    res.cookie("token", token, COOKIE_OPTIONS);

    return SuccessHandler(
      {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
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
  res.clearCookie("token", COOKIE_OPTIONS);

  return SuccessHandler(null, res, 200, "Logged out successfully");
}
