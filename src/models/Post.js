import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    heading: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    imageLink: {
      type: String,
      trim: true,
      default: "",
    },
    reactCount: {
      upvote: {
        type: Number,
        default: 0,
        min: 0,
      },
      downvote: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

postSchema
  .virtual("reactcount")
  .get(function () {
    return this.reactCount;
  })
  .set(function (val) {
    this.reactCount = val;
  });

export const Post = mongoose.model("Post", postSchema);
export default Post;

