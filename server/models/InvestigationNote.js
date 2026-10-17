import mongoose from "mongoose";

const investigationNoteSchema = new mongoose.Schema(
  {
    noteId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    bugId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    bug: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bug",
      index: true,
    },
    userId: {
      type: String,
      default: "dev-user",
      index: true,
    },
    author: {
      type: String,
      default: "AI Agent",
      trim: true,
    },
    hypothesis: {
      type: String,
      default: "",
    },
    details: {
      type: String,
      required: true,
    },
    suggestedFix: {
      type: String,
      default: "",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "investigation_notes",
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret.noteId;
        if (ret._id) ret._id = ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

investigationNoteSchema.index({ bugId: 1, createdAt: 1 });
investigationNoteSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.InvestigationNote ||
  mongoose.model("InvestigationNote", investigationNoteSchema);
