import "dotenv/config";
import mongoose from "mongoose";
import { Group } from "../models/Group.js";
import { UserProfile } from "../models/UserProfile.js";

async function syncMemberships() {
  try {
    const mongoUri = process.env.DATABASE_URL;
    if (!mongoUri) {
      console.error("DATABASE_URL is not set in environment.");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const groups = await Group.find({});
    console.log(`Found ${groups.length} groups to reconcile.`);

    let syncedCount = 0;

    for (const group of groups) {
      const allMemberIds = new Set();

      if (group.creator) {
        allMemberIds.add(group.creator.toString());
      }

      if (Array.isArray(group.members)) {
        group.members.forEach((m) => allMemberIds.add(m.toString()));
      }

      for (const userId of allMemberIds) {
        await UserProfile.findOneAndUpdate(
          { user: userId },
          { $addToSet: { groups: group._id } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        syncedCount++;
      }
    }

    console.log(`Membership synchronization complete. Synced ${syncedCount} user-group relations.`);
  } catch (error) {
    console.error("Error during membership sync:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

syncMemberships();
