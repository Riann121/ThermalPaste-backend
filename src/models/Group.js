import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    // ─── Identification & Metadata ────────────────────────────
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    tagline: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      default: "hardware",
    },

    // ─── Visuals & Media ──────────────────────────────────────
    groupIconLink: {
      type: String,
      trim: true,
      default: "",
    },
    bannerLink: {
      type: String,
      trim: true,
      default: "",
    },

    // ─── Privacy & Access Control ─────────────────────────────
    privacy: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },

    // ─── Ownership & Members ──────────────────────────────────
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Pending requests for private groups
    joinRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

export const Group = mongoose.model("Group", groupSchema);
export default Group;
