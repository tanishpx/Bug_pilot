import "dotenv/config";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB, disconnectDB } from "../config/db.js";
import Bug from "../models/Bug.js";
import InvestigationNote from "../models/InvestigationNote.js";
import User from "../models/User.js";
import Submission from "../models/Submission.js";

export async function runMigration() {
  console.log("=== Running Bug_Pilot Database Migration ===");
  await connectDB();

  // 1. Ensure indexes across all models
  console.log("→ Synchronizing indexes for User, Bug, InvestigationNote, and Submission...");
  const models = [
    { name: "User", model: User },
    { name: "Bug", model: Bug },
    { name: "InvestigationNote", model: InvestigationNote },
    { name: "Submission", model: Submission },
  ];

  for (const { name, model } of models) {
    try {
      await model.init();
      await model.syncIndexes();
      console.log(`✓ Synchronized indexes for ${name}`);
    } catch (err) {
      console.warn(`! Note for ${name} index synchronization: ${err.message}`);
    }
  }

  // 2. Migrate legacy feedbackforms documents into bugs collection if present
  try {
    const rawLegacy = await mongoose.connection.db
      .collection("feedbackforms")
      .find({})
      .toArray();

    if (rawLegacy.length > 0) {
      console.log(`→ Found ${rawLegacy.length} document(s) in legacy 'feedbackforms' collection. Checking migration...`);
      let migratedCount = 0;

      for (const item of rawLegacy) {
        const bugIdentifier = item.formId || item.bugId || `BUG-${item._id}`;
        const existing = await Bug.findOne({
          $or: [{ bugId: bugIdentifier }, { formId: bugIdentifier }, { _id: item._id }],
        });

        if (!existing) {
          await Bug.create({
            _id: item._id,
            bugId: bugIdentifier,
            formId: bugIdentifier,
            title: item.title || "Legacy Form Bug",
            description: item.description || "",
            bugType: item.bugType || "UI",
            severity: item.severity || "Medium",
            priority: item.priority || "P2",
            status: item.status || "Open",
            assignee: item.assignee || "Unassigned",
            reporter: item.reporter || "",
            environment: item.environment || "",
            tags: item.tags || [],
            isPublic: item.isPublic !== false,
            userId: item.userId || "dev-user",
            createdAt: item.createdAt || new Date(),
            updatedAt: item.updatedAt || new Date(),
          });
          migratedCount++;
        }
      }
      console.log(`✓ Migrated ${migratedCount} legacy document(s) into 'bugs' collection.`);
    }
  } catch (err) {
    console.warn("Notice: Legacy migration skipped or not needed:", err.message);
  }

  console.log("=== Migration completed successfully ===");
}

// Allow direct execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigration()
    .then(() => disconnectDB())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration error:", err);
      process.exit(1);
    });
}
