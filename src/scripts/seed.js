import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  User,
  UserProfile,
  Group,
  Post,
  Comment,
  SavedPost,
} from "../models/index.js";

const USERS_DATA = [
  {
    username: "thermal_guru",
    email: "guru@thermalpaste.com",
    bio: "Obsessed with sub-ambient cooling and liquid metal delidding. 10+ years in PC tuning.",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  },
  {
    username: "silicon_sam",
    email: "sam@thermalpaste.com",
    bio: "SFF enthusiast & custom waterloop builder. Mini-ITX or bust.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  },
  {
    username: "arctic_fox",
    email: "fox@thermalpaste.com",
    bio: "Benchmarking every thermal interface material known to mankind.",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
  },
  {
    username: "volt_rider",
    email: "volt@thermalpaste.com",
    bio: "Overclocking competitive bencher. Pushing silicon past manufacturer warnings.",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  },
];

const GROUPS_DATA = [
  {
    name: "pc-building",
    tagline: "Build guides, part lists, and cable management showcases",
    description: "The premier hub for custom rig builders, workstation engineers, and budget gaming battlestations.",
    category: "hardware",
    privacy: "public",
    groupIconLink: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=150&auto=format&fit=crop&q=80",
    bannerLink: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&auto=format&fit=crop&q=80",
  },
  {
    name: "overclocking",
    tagline: "Voltages, timings, and thermal dissipation thresholds",
    description: "Everything CPU, GPU, and RAM overclocking. Share stable profiles, benchmark leaderboards, and cooling setups.",
    category: "hardware",
    privacy: "public",
    groupIconLink: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=150&auto=format&fit=crop&q=80",
    bannerLink: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80",
  },
  {
    name: "thermal-labs",
    tagline: "Thermal pads, paste viscosity, and phase-change research",
    description: "Scientific thermal paste testing, delta-T measurements, mount pressure analysis, and cold-plate flatness tests.",
    category: "cooling",
    privacy: "public",
    groupIconLink: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=150&auto=format&fit=crop&q=80",
    bannerLink: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80",
  },
  {
    name: "custom-cooling",
    tagline: "Hardline tubing, radiators, and silent pump loops",
    description: "Show off custom water loops, distribution plates, quick-disconnect fittings, and copper block craftsmanship.",
    category: "cooling",
    privacy: "public",
    groupIconLink: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=150&auto=format&fit=crop&q=80",
    bannerLink: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&auto=format&fit=crop&q=80",
  },
];

async function seed() {
  try {
    const mongoUri = process.env.DATABASE_URL;
    if (!mongoUri) {
      console.error("DATABASE_URL is missing in environment.");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected.");

    // ── 1. Create or Find Users ──────────────────────────────────────────────
    console.log("Seeding users...");
    const salt = await bcrypt.genSalt(10);
    const defaultHashedPassword = await bcrypt.hash("Password123!", salt);

    const userDocs = [];

    for (const u of USERS_DATA) {
      let user = await User.findOne({ email: u.email });
      if (!user) {
        user = await User.create({
          username: u.username,
          email: u.email,
          password: defaultHashedPassword,
        });
      }

      await UserProfile.findOneAndUpdate(
        { user: user._id },
        {
          $set: {
            bio: u.bio,
            imageLink: u.avatar,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      userDocs.push(user);
    }

    console.log(`Prepared ${userDocs.length} users.`);

    // ── 2. Create or Find Groups ─────────────────────────────────────────────
    console.log("Seeding groups...");
    const groupDocs = [];
    const allUserIds = userDocs.map((u) => u._id);

    for (let i = 0; i < GROUPS_DATA.length; i++) {
      const g = GROUPS_DATA[i];
      const creator = userDocs[i % userDocs.length];

      let group = await Group.findOne({ name: g.name });
      if (!group) {
        group = await Group.create({
          ...g,
          creator: creator._id,
          members: allUserIds,
        });
      } else {
        group.members = allUserIds;
        await group.save();
      }

      groupDocs.push(group);

      // Sync to all members' UserProfiles
      for (const uid of allUserIds) {
        await UserProfile.findOneAndUpdate(
          { user: uid },
          { $addToSet: { groups: group._id } },
          { upsert: true },
        );
      }
    }

    console.log(`Prepared ${groupDocs.length} groups with synced memberships.`);

    // ── 3. Seed Posts ────────────────────────────────────────────────────────
    console.log("Seeding posts...");
    const POSTS_DATA = [
      {
        userIndex: 0,
        groupIndex: 2, // thermal-labs
        heading: "Arctic MX-6 vs Thermal Grizzly Kryonaut Extreme: 6-Month Longevity Test",
        description:
          "After 180 days of continuous 24/7 rendering load on an Intel i9-14900KS, here are the pump-out degradation metrics and thermal paste pump-out comparisons. Kryonaut showed slight dry-out at 95°C peaks, whereas MX-6 maintained uniform viscosity across the IHS die contact perimeter.",
        imageLink:
          "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&auto=format&fit=crop&q=80",
      },
      {
        userIndex: 1,
        groupIndex: 0, // pc-building
        heading: "FormD T1 V2.1 Titanium SFF Build: 7800X3D + RTX 4090 FE (9.95L)",
        description:
          "Custom unsleeved silver silicon cables, 240mm AIO with slim Phanteks T30 fans exhausting out the top. Maximum CPU temp sits at 74°C during Cyberpunk 2077 4K Overdrive. Total volume under 10 Liters!",
        imageLink:
          "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&auto=format&fit=crop&q=80",
      },
      {
        userIndex: 2,
        groupIndex: 2, // thermal-labs
        heading: "PSA: Why the 'Pea Method' is Failing Modern Rectangular CPU Sockets (LGA1700 / AM5)",
        description:
          "Due to the elongated rectangular aspect ratio of LGA1700 and the hot-spot concentration near the IOD/CCD offset on AM5, a simple center pea leaves the corners dry under mounting torque. A spread method or multi-dot X-pattern consistently gives a 2-4°C reduction in core delta.",
        imageLink:
          "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80",
      },
      {
        userIndex: 3,
        groupIndex: 1, // overclocking
        heading: "DDR5-8000 CL34 Stable Profile on Apex Encore with 14900K",
        description:
          "Finally passed 20,000% Karhu RAM Test and 2 hours of y-cruncher VST. Voltages: VDD/VDDQ at 1.52V, SA at 1.25V, TX VDDQ at 1.35V. Active 60mm Noctua fan positioned directly over the DIMMs is strictly mandatory to prevent thermal errors past 48°C.",
        imageLink:
          "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80",
      },
      {
        userIndex: 1,
        groupIndex: 3, // custom-cooling
        heading: "Dual 360mm Radiator Loop Finished with Frosted Satin Hardline Tubing",
        description:
          "EK Quantum Velocity2 CPU block, Heatkiller V Pro GPU block, Watercool MO-RA3 standalone readiness with quick-disconnects on the PCI pass-through bracket. Coolant delta stays under 4°C above ambient with fans at 800 RPM in total silence.",
        imageLink:
          "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80",
      },
      {
        userIndex: 0,
        groupIndex: 0, // pc-building
        heading: "Cable Management Checklist: How to Achieve Front-and-Back Symmetry",
        description:
          "Velcro anchor points, custom channel routings behind the motherboard tray, comb spacing rules, and routing EPS 8-pin cables through the top chassis cutout prior to fastening the motherboard.",
        imageLink:
          "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
      },
    ];

    const createdPosts = [];

    for (const p of POSTS_DATA) {
      const author = userDocs[p.userIndex];
      const targetGroup = groupDocs[p.groupIndex];

      let existingPost = await Post.findOne({ heading: p.heading });
      if (!existingPost) {
        existingPost = await Post.create({
          user: author._id,
          group: targetGroup._id,
          heading: p.heading,
          description: p.description,
          imageLink: p.imageLink,
        });
      }
      createdPosts.push(existingPost);
    }

    console.log(`Created/Verified ${createdPosts.length} posts.`);

    // ── 4. Seed Threaded Comments ────────────────────────────────────────────
    console.log("Seeding comments & replies...");
    if (createdPosts.length > 0) {
      const post0 = createdPosts[0]; // Thermal paste longevity post

      let rootComment1 = await Comment.findOne({
        post: post0._id,
        parentComment: null,
      });

      if (!rootComment1) {
        rootComment1 = await Comment.create({
          user: userDocs[1]._id, // silicon_sam
          post: post0._id,
          parentComment: null,
          comment:
            "Did you notice any galvanic corrosion or staining on the nickel plating with the Kryonaut Extreme over those 6 months?",
          likes: [userDocs[0]._id, userDocs[2]._id],
        });

        // Reply to rootComment1
        await Comment.create({
          user: userDocs[0]._id, // thermal_guru (author reply)
          post: post0._id,
          parentComment: rootComment1._id,
          comment:
            "Zero nickel discoloration! It wiped off cleanly with 99% isopropyl alcohol. The only downside was the center zone drying out slightly due to the sustained 90C+ hotspot load.",
          likes: [userDocs[1]._id],
        });

        // Another top-level comment
        await Comment.create({
          user: userDocs[3]._id, // volt_rider
          post: post0._id,
          parentComment: null,
          comment:
            "Have you considered testing Honeywell PTM7950 phase-change pads next? They solve pump-out completely on bare dies.",
          likes: [userDocs[0]._id],
        });
      }

      // Add a comment to the SFF build post
      if (createdPosts.length > 1) {
        const post1 = createdPosts[1];
        const existingComment = await Comment.findOne({ post: post1._id });
        if (!existingComment) {
          await Comment.create({
            user: userDocs[2]._id,
            post: post1._id,
            parentComment: null,
            comment:
              "Stunning cable routing! What length did you cut the 12VHPWR cable to avoid pushing against the side mesh panel?",
            likes: [userDocs[1]._id],
          });
        }
      }
    }

    // ── 5. Seed Saved Posts ──────────────────────────────────────────────────
    console.log("Seeding saved posts (bookmarks)...");
    for (let i = 0; i < Math.min(3, createdPosts.length); i++) {
      for (const u of userDocs) {
        await SavedPost.findOneAndUpdate(
          { user: u._id, post: createdPosts[i]._id },
          { user: u._id, post: createdPosts[i]._id },
          { upsert: true },
        );
      }
    }

    console.log("\n=======================================================");
    console.log("✅ SEEDING COMPLETE!");
    console.log("Test Login Credentials (for any seeded user):");
    console.log("  Password for all accounts: Password123!");
    console.log("  Email 1: guru@thermalpaste.com  (Username: thermal_guru)");
    console.log("  Email 2: sam@thermalpaste.com   (Username: silicon_sam)");
    console.log("  Email 3: fox@thermalpaste.com   (Username: arctic_fox)");
    console.log("  Email 4: volt@thermalpaste.com  (Username: volt_rider)");
    console.log("=======================================================\n");
  } catch (error) {
    console.error("Seeding error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

seed();
