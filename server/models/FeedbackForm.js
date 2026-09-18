import mongoose from "mongoose";

const feedbackFormSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    formId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    bugType: {
      type: String,
      enum: ["UI", "Runtime", "Performance", "Security", "API", "Other"],
      default: "UI",
    },
    severity: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },
    priority: {
      type: String,
      enum: ["P0", "P1", "P2", "P3"],
      default: "P2",
    },
    status: {
      type: String,
      enum: [
        "Open",
        "Triaged",
        "Assigned",
        "In Progress",
        "Resolved",
        "Fixed",
        "Retest",
        "Closed",
        "Reopened",
      ],
      default: "Open",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    assignee: {
      type: String,
      default: "Unassigned",
    },
    reporter: {
      type: String,
      default: "",
    },
    environment: {
      type: String,
      default: "",
    },
    tags: {
      type: [String],
      default: [],
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

feedbackFormSchema.index({ userId: 1, createdAt: -1 });
feedbackFormSchema.index({ userId: 1, status: 1 });
feedbackFormSchema.index({ userId: 1, severity: 1 });

export default mongoose.model("FeedbackForm", feedbackFormSchema);
