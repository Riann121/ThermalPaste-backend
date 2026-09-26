import express from "express";
import checkToken from "../middleware/checkToken.js";
import { upload } from "../middleware/upload.js";
import {
  createProfile,
  getProfile,
  updateProfile,
  deleteProfile,
  uploadProfileImage,
} from "../controllers/profileController.js";

const router = express.Router();

router.post("/", checkToken, createProfile);
router.get("/", checkToken, getProfile);
router.put("/", checkToken, updateProfile);
router.delete("/", checkToken, deleteProfile);
router.post("/image", checkToken, upload.single("image"), uploadProfileImage);

export default router;
