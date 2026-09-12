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
  },
  { timestamps: true },
);

export const UserProfile = mongoose.model("UserProfile", userProfileSchema);
export default UserProfile;
