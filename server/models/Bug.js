import mongoose from "mongoose";

const bugSchema = new mongoose.Schema(
  {
    bugId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    // Retain formId for backwards compatibility with earlier API consumers
    formId: {
      type: String,
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
      enum: [
        "UI",
        "Backend",
        "Performance",
        "Security",
        "Database",
        "Runtime",
        "API",
        "Other",
      ],
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
        "New",
        "Open",
        "Triaged",
        "Assigned",
        "In Progress",
        "Resolved",
        "Fixed",
        "Retest",
        "Closed",
        "Reopened",
        "Accepted",
        "Rejected",
      ],
      default: "New",
    },
    stepsToReproduce: {
      type: String,
      default: "",
    },
    environment: {
      type: String,
      default: "",
    },
    reporterEmail: {
      type: String,
      default: "",
    },
    reporter: {
      type: String,
      default: "",
    },
    assignee: {
      type: String,
      default: "Unassigned",
    },
    attachments: {
      type: [String],
      default: [],
    },
    logs: {
      type: String,
      default: "",
    },
    relatedFiles: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    userId: {
      type: String,
      default: "dev-user",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "bugs",
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret.bugId;
        ret.formId = ret.bugId;
        ret.type = ret.bugType;
        if (ret._id) ret._id = ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Keep formId synchronized with bugId before saving
bugSchema.pre("save", function (next) {
  if (!this.formId) {
    this.formId = this.bugId;
  }
  if (!this.reporter && this.reporterEmail) {
    this.reporter = this.reporterEmail;
  }
  next();
});

// Compound indexes for optimal querying
bugSchema.index({ userId: 1, createdAt: -1 });
bugSchema.index({ status: 1, createdAt: -1 });
bugSchema.index({ severity: 1, createdAt: -1 });
bugSchema.index({ bugType: 1 });
bugSchema.index({ title: "text", description: "text", logs: "text" });

const Bug = mongoose.models.Bug || mongoose.model("Bug", bugSchema);

if (!mongoose.models.FeedbackForm) {
  mongoose.model("FeedbackForm", bugSchema);
}

export default Bug;
