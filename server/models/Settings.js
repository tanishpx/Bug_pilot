import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    newBugNotifications: {
      type: Boolean,
      default: false,
    },
    statusChangeNotifications: {
      type: Boolean,
      default: false,
    },
    notificationEmail: {
      type: String,
      default: "",
    },
    applicationName: {
      type: String,
      default: "BugPilot",
    },
    supportEmail: {
      type: String,
      default: "support@bugpilot.com",
    },
    theme: {
      type: String,
      enum: ["Light", "Dark", "System"],
      default: "System",
    },
    primaryColor: {
      type: String,
      default: "#7c3aed",
    },
    mcpEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Settings", settingsSchema);
