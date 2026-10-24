import mongoose from "mongoose";
import Bug from "../models/Bug.js";
import InvestigationNote from "../models/InvestigationNote.js";
import Submission from "../models/Submission.js";
import { sendStatusChangeEmail } from "./emailService.js";
import {
  escapeRegExp,
  isValidEmail,
  pickBugUpdates,
  validateBugFields,
  validateInvestigationNote,
} from "../utils/validation.js";

// Domain-level failure with an HTTP-safe status. Unexpected errors bubble to the
// controller, which turns them into a generic 500.
export class BugServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "BugServiceError";
    this.status = status;
  }
}

function fail(status, message) {
  throw new BugServiceError(status, message);
}

// Find a Bug by bugId (e.g. BUG-101), legacy formId, or MongoDB ObjectId.
export async function findBugByIdentifier(identifier, userFilter = null) {
  if (!identifier) return null;

  const conditions = [{ bugId: identifier }, { formId: identifier }];
  if (mongoose.isValidObjectId(identifier)) {
    conditions.push({ _id: identifier });
  }

  const query = { $or: conditions };
  if (userFilter) {
    query.userId = userFilter;
  }

  return Bug.findOne(query).lean();
}

function formatNotes(notes) {
  return notes.map((note) => ({ ...note, id: note.noteId }));
}

function formatBug(bug, notes = []) {
  const plain = typeof bug.toObject === "function" ? bug.toObject() : bug;

  return {
    ...plain,
    id: bug.bugId,
    formId: bug.bugId,
    type: bug.bugType,
    investigationNotes: formatNotes(notes),
  };
}

export async function listBugs(params = {}) {
  const {
    userId,
    status,
    severity,
    priority,
    bugType,
    type,
    search,
    reporter,
    reporterEmail,
    myBugs,
    limit,
    page,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = params;

  const filter = {};

  // Allow user-scoped isolation when explicitly requested
  if (myBugs === "true" && userId) {
    filter.userId = userId;
  }

  const effectiveType = bugType || type;
  if (effectiveType) filter.bugType = effectiveType;
  if (status) filter.status = status;
  if (severity) filter.severity = severity;
  if (priority) filter.priority = priority;

  const effectiveReporter = reporter || reporterEmail;
  if (effectiveReporter) {
    const safeReporter = escapeRegExp(effectiveReporter);
    filter.$or = [
      { reporter: { $regex: safeReporter, $options: "i" } },
      { reporterEmail: { $regex: safeReporter, $options: "i" } },
    ];
  }

  if (search) {
    const safeSearch = escapeRegExp(search);
    const searchOr = [
      { title: { $regex: safeSearch, $options: "i" } },
      { description: { $regex: safeSearch, $options: "i" } },
      { assignee: { $regex: safeSearch, $options: "i" } },
      { bugId: { $regex: safeSearch, $options: "i" } },
      { logs: { $regex: safeSearch, $options: "i" } },
    ];

    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
      delete filter.$or;
    } else {
      filter.$or = searchOr;
    }
  }

  const maxLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
  const currentPage = Math.max(parseInt(page, 10) || 1, 1);
  const skip = (currentPage - 1) * maxLimit;
  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

  const bugs = await Bug.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(maxLimit)
    .lean();

  const bugIds = bugs.map((bug) => bug.bugId);
  const notes = await InvestigationNote.find({ bugId: { $in: bugIds } }).lean();

  const notesByBugId = {};
  for (const note of notes) {
    if (!notesByBugId[note.bugId]) notesByBugId[note.bugId] = [];
    notesByBugId[note.bugId].push(note);
  }

  return bugs.map((bug) => formatBug(bug, notesByBugId[bug.bugId] || []));
}

export async function getBug(identifier) {
  const bug = await findBugByIdentifier(identifier);
  if (!bug) {
    fail(404, `Bug with ID "${identifier}" not found`);
  }

  const notes = await InvestigationNote.find({ bugId: bug.bugId })
    .sort({ createdAt: 1 })
    .lean();

  return formatBug(bug, notes);
}

// Generates next available sequential BUG-X identifier without colliding with existing documents
async function getNextBugId() {
  const bugs = await Bug.find({ bugId: /^BUG-\d+$/ })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  let maxNum = 100;
  for (const b of bugs) {
    const match = b.bugId?.match(/^BUG-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum && num < 10000000) {
        maxNum = num;
      }
    }
  }

  let candidate = `BUG-${maxNum + 1}`;
  while (await Bug.exists({ bugId: candidate })) {
    maxNum++;
    candidate = `BUG-${maxNum + 1}`;
  }
  return candidate;
}

export async function createBug(input = {}, userId = "dev-user") {
  const {
    title,
    description,
    bugType,
    type,
    severity,
    priority,
    status,
    assignee,
    reporter,
    reporterEmail,
    environment,
    stepsToReproduce,
    logs,
    relatedFiles,
    attachments,
    tags,
    isPublic,
    id,
    bugId,
  } = input;

  if (!title || !title.trim()) {
    fail(400, "Title is required");
  }

  const effectiveType = bugType || type || "UI";

  let cleanReporterEmail = reporterEmail ? String(reporterEmail).trim() : "";
  let cleanReporter = reporter ? String(reporter).trim() : "";

  // If user entered a username/handle/name in reporterEmail, use it as reporter
  if (cleanReporterEmail && !isValidEmail(cleanReporterEmail)) {
    if (!cleanReporter) {
      cleanReporter = cleanReporterEmail;
    }
    cleanReporterEmail = "";
  }

  const validationError = validateBugFields({
    title,
    bugType: effectiveType,
    severity: severity || "Medium",
    priority: priority || "P2",
    status: status || "New",
    tags,
    attachments,
    relatedFiles,
    reporterEmail: cleanReporterEmail,
  });

  if (validationError) {
    fail(400, validationError);
  }

  // Determine unique bug ID safely
  let assignedBugId = (bugId || id || "").trim();
  if (!assignedBugId || (await Bug.exists({ bugId: assignedBugId }))) {
    assignedBugId = await getNextBugId();
  }

  const bug = await Bug.create({
    userId: userId || "dev-user",
    bugId: assignedBugId,
    formId: assignedBugId,
    title: title.trim(),
    description: description ? description.trim() : "",
    bugType: effectiveType,
    severity: severity || "Medium",
    priority: priority || "P2",
    status: status || "New",
    assignee: (assignee && assignee.trim()) || "Unassigned",
    reporter: cleanReporter || cleanReporterEmail || "",
    reporterEmail: cleanReporterEmail,
    environment: environment ? environment.trim() : "",
    stepsToReproduce: stepsToReproduce ? stepsToReproduce.trim() : "",
    logs: logs ? logs.trim() : "",
    relatedFiles: Array.isArray(relatedFiles) ? relatedFiles : [],
    attachments: Array.isArray(attachments) ? attachments : [],
    tags: Array.isArray(tags) ? tags : [],
    isPublic: isPublic !== false,
  });

  return formatBug(bug, []);
}

export async function updateBug(identifier, body = {}) {
  const updates = pickBugUpdates(body);
  const validationError = validateBugFields(updates);
  if (validationError) {
    fail(400, validationError);
  }

  if (updates.title !== undefined) {
    updates.title = updates.title.trim();
  }

  const originalBug = await findBugByIdentifier(identifier);
  if (!originalBug) {
    fail(404, `Bug with ID "${identifier}" not found`);
  }

  const previousStatus = originalBug.status;

  if (
    updates.status &&
    ["Resolved", "Fixed", "Closed"].includes(updates.status) &&
    !["Resolved", "Fixed", "Closed"].includes(previousStatus)
  ) {
    updates.resolvedAt = new Date();
  }

  const updatedBug = await Bug.findByIdAndUpdate(
    originalBug._id,
    { ...updates, updatedAt: new Date() },
    { new: true }
  );

  if (updates.status && updates.status !== previousStatus) {
    sendStatusChangeEmail({
      userId: originalBug.userId,
      title: updatedBug.title,
      previousStatus,
      newStatus: updatedBug.status,
      date: new Date().toLocaleString(),
    }).catch((err) =>
      console.error("Async status change email dispatch failed:", err.message)
    );
  }

  const notes = await InvestigationNote.find({ bugId: updatedBug.bugId })
    .sort({ createdAt: 1 })
    .lean();

  return formatBug(updatedBug, notes);
}

export async function deleteBug(identifier) {
  const bug = await findBugByIdentifier(identifier);
  if (!bug) {
    fail(404, `Bug with ID "${identifier}" not found`);
  }

  await Bug.findByIdAndDelete(bug._id);
  await InvestigationNote.deleteMany({ bugId: bug.bugId });
  await Submission.deleteMany({ formId: bug._id });

  return {
    message: "Bug and associated records deleted successfully",
    bugId: bug.bugId,
  };
}

export async function getInvestigationNotes(identifier) {
  const bug = await findBugByIdentifier(identifier);
  if (!bug) {
    fail(404, `Bug with ID "${identifier}" not found`);
  }

  const notes = await InvestigationNote.find({ bugId: bug.bugId })
    .sort({ createdAt: 1 })
    .lean();

  return formatNotes(notes);
}

export async function addInvestigationNote(identifier, input = {}, userId = "dev-user") {
  const { hypothesis, details, suggestedFix, author } = input;

  const validationError = validateInvestigationNote({ details });
  if (validationError) {
    fail(400, validationError);
  }

  const bug = await findBugByIdentifier(identifier);
  if (!bug) {
    fail(404, `Bug with ID "${identifier}" not found`);
  }

  const count = await InvestigationNote.countDocuments();
  const noteId = `NOTE-${count + 1}-${Date.now().toString().slice(-4)}`;

  const note = await InvestigationNote.create({
    noteId,
    bugId: bug.bugId,
    bug: bug._id,
    userId: userId || "dev-user",
    author: (author && author.trim()) || "AI Agent",
    hypothesis: hypothesis ? hypothesis.trim() : "",
    details: details.trim(),
    suggestedFix: suggestedFix ? suggestedFix.trim() : "",
    timestamp: new Date(),
  });

  // Touch bug updatedAt
  await Bug.findByIdAndUpdate(bug._id, { updatedAt: new Date() });

  return { ...note.toObject(), id: note.noteId };
}
