import express from "express";
import { login, register, logout } from "../controllers/authController.js";
import checkToken from "../middleware/checkToken.js";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.post("/logout", checkToken, logout);

export default router;
