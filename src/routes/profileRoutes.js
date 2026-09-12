import express from "express";
import checkToken from "../middleware/checkToken.js";
import {
  createProfile,
  getProfile,
  updateProfile,
  deleteProfile,
} from "../controllers/profileController.js";

const router = express.Router();

router.post("/", checkToken, createProfile);
router.get("/", checkToken, getProfile);
router.put("/", checkToken, updateProfile);
router.delete("/", checkToken, deleteProfile);

export default router;
