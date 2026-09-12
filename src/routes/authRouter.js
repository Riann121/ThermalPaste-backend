import express from "express";
import {
  login,
  register,
  logout,
  me,
  refresh,
} from "../controllers/authController.js";
import checkToken from "../middleware/checkToken.js";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.post("/logout", logout);
router.get("/me", checkToken, me);
router.post("/refresh", refresh);

export default router;
