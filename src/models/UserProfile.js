import mongoose from "mongoose";

const userProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    imageLink: {
      type: String,
      trim: true,
      default: "",
    },
    bio: {
      type: String,
      trim: true,
      default: "",
    },
    cpu: {
      type: String,
      trim: true,
      default: "",
    },
    gpu: {
      type: String,
      trim: true,
      default: "",
    },
    ram: {
      type: String,
      trim: true,
      default: "",
    },
    motherboard: {
      type: String,
      trim: true,
      default: "",
    },
    customCooler: {
      type: String,
      trim: true,
      default: "",
    },
    pcCase: {
      type: String,
      trim: true,
      default: "",
    },
    powerSupply: {
      type: String,
      trim: true,
      default: "",
    },
    storage: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

export const UserProfile = mongoose.model("UserProfile", userProfileSchema);
export default UserProfile;
