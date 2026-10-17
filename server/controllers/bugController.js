import mongoose from "mongoose";
import Bug from "../models/Bug.js";
import InvestigationNote from "../models/InvestigationNote.js";
import Submission from "../models/Submission.js";
import { sendNewBugEmail, sendStatusChangeEmail } from "../services/emailService.js";
import {
  escapeRegExp,
  isValidEmail,
  pickBugUpdates,
  validateBugFields,
  validateInvestigationNote,
} from "../utils/validation.js";

// Helper to find a bug by either bugId (e.g. BUG-101), legacy formId, or MongoDB ObjectId
export async function findBugByIdentifier(identifier, userFilter = null) {
  if (!identifier) return null;

  const conditions = [
    { bugId: identifier },
    { formId: identifier },
  ];

  if (mongoose.isValidObjectId(identifier)) {
    conditions.push({ _id: identifier });
  }

  const query = { $or: conditions };
  if (userFilter) {
    query.userId = userFilter;
  }

  return Bug.findOne(query);
}

export async function getBugs(req, res) {
  try {
    const {
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
    } = req.query;

    const filter = {};

    // Allow user-scoped isolation when explicitly requested
    if (myBugs === "true" && req.userId) {
      filter.userId = req.userId;
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

    // Attach investigationNotes count and format clean objects
    const bugIds = bugs.map((b) => b.bugId);
    const notes = await InvestigationNote.find({ bugId: { $in: bugIds } }).lean();

    const notesByBugId = {};
    for (const note of notes) {
      if (!notesByBugId[note.bugId]) notesByBugId[note.bugId] = [];
      notesByBugId[note.bugId].push(note);
    }

    const formattedBugs = bugs.map((b) => ({
      ...b,
      id: b.bugId,
      formId: b.bugId,
      type: b.bugType,
      investigationNotes: notesByBugId[b.bugId] || [],
    }));

    res.json(formattedBugs);
  } catch (err) {
    console.error("[getBugs] Error:", err.message);
    res.status(500).json({ error: "Failed to retrieve bugs" });
  }
}

export async function getBugById(req, res) {
  try {
    const { id, formId } = req.params;
    const identifier = id || formId;

    const bug = await findBugByIdentifier(identifier);
    if (!bug) {
      return res.status(404).json({ error: `Bug with ID "${identifier}" not found` });
    }

    const notes = await InvestigationNote.find({ bugId: bug.bugId })
      .sort({ createdAt: 1 })
      .lean();

    const result = {
      ...bug.toObject(),
      id: bug.bugId,
      formId: bug.bugId,
      type: bug.bugType,
      investigationNotes: notes.map((n) => ({
        ...n,
        id: n.noteId,
      })),
    };

    res.json(result);
  } catch (err) {
    console.error("[getBugById] Error:", err.message);
    res.status(500).json({ error: "Failed to retrieve bug details" });
  }
}

export async function createBug(req, res) {
  try {
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
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    const effectiveType = bugType || type || "UI";
    const validationError = validateBugFields({
      title,
      bugType: effectiveType,
      severity: severity || "Medium",
      priority: priority || "P2",
      status: status || "New",
      tags,
      attachments,
      relatedFiles,
      reporterEmail,
    });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    // Determine unique bug ID (custom, BUG-sequential, or timestamp-based)
    let assignedBugId = bugId || id;
    if (!assignedBugId) {
      const count = await Bug.countDocuments();
      assignedBugId = `BUG-${count + 101}`;
    }

    // Ensure uniqueness if collision occurs
    const existing = await Bug.findOne({ bugId: assignedBugId });
    if (existing) {
      assignedBugId = `BUG-${Date.now()}`;
    }

    const bug = await Bug.create({
      userId: req.userId || "dev-user",
      bugId: assignedBugId,
      formId: assignedBugId,
      title: title.trim(),
      description: description ? description.trim() : "",
      bugType: effectiveType,
      severity: severity || "Medium",
      priority: priority || "P2",
      status: status || "New",
      assignee: (assignee && assignee.trim()) || "Unassigned",
      reporter: (reporter && reporter.trim()) || reporterEmail || "",
      reporterEmail: (reporterEmail && reporterEmail.trim()) || "",
      environment: environment ? environment.trim() : "",
      stepsToReproduce: stepsToReproduce ? stepsToReproduce.trim() : "",
      logs: logs ? logs.trim() : "",
      relatedFiles: Array.isArray(relatedFiles) ? relatedFiles : [],
      attachments: Array.isArray(attachments) ? attachments : [],
      tags: Array.isArray(tags) ? tags : [],
      isPublic: isPublic !== false,
    });

    const result = {
      ...bug.toObject(),
      id: bug.bugId,
      formId: bug.bugId,
      type: bug.bugType,
      investigationNotes: [],
    };

    res.status(201).json(result);
  } catch (err) {
    console.error("[createBug] Error:", err.message);
    res.status(500).json({ error: "Failed to create bug" });
  }
}

export async function updateBug(req, res) {
  try {
    const { id, formId } = req.params;
    const identifier = id || formId;

    const updates = pickBugUpdates(req.body);
    const validationError = validateBugFields(updates);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (updates.title !== undefined) {
      updates.title = updates.title.trim();
    }

    const originalBug = await findBugByIdentifier(identifier);
    if (!originalBug) {
      return res.status(404).json({ error: `Bug with ID "${identifier}" not found` });
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

    const result = {
      ...updatedBug.toObject(),
      id: updatedBug.bugId,
      formId: updatedBug.bugId,
      type: updatedBug.bugType,
      investigationNotes: notes.map((n) => ({ ...n, id: n.noteId })),
    };

    res.json(result);
  } catch (err) {
    console.error("[updateBug] Error:", err.message);
    res.status(500).json({ error: "Failed to update bug" });
  }
}

export async function deleteBug(req, res) {
  try {
    const { id, formId } = req.params;
    const identifier = id || formId;

    const bug = await findBugByIdentifier(identifier);
    if (!bug) {
      return res.status(404).json({ error: `Bug with ID "${identifier}" not found` });
    }

    await Bug.findByIdAndDelete(bug._id);
    await InvestigationNote.deleteMany({ bugId: bug.bugId });
    await Submission.deleteMany({ formId: bug._id });

    res.json({
      message: "Bug and associated records deleted successfully",
      bugId: bug.bugId,
    });
  } catch (err) {
    console.error("[deleteBug] Error:", err.message);
    res.status(500).json({ error: "Failed to delete bug" });
  }
}

export async function getInvestigationNotes(req, res) {
  try {
    const { id, formId } = req.params;
    const identifier = id || formId;

    const bug = await findBugByIdentifier(identifier);
    if (!bug) {
      return res.status(404).json({ error: `Bug with ID "${identifier}" not found` });
    }

    const notes = await InvestigationNote.find({ bugId: bug.bugId })
      .sort({ createdAt: 1 })
      .lean();

    res.json(notes.map((n) => ({ ...n, id: n.noteId })));
  } catch (err) {
    console.error("[getInvestigationNotes] Error:", err.message);
    res.status(500).json({ error: "Failed to retrieve investigation notes" });
  }
}

export async function addInvestigationNote(req, res) {
  try {
    const { id, formId } = req.params;
    const identifier = id || formId;
    const { hypothesis, details, suggestedFix, author } = req.body;

    const validationError = validateInvestigationNote({ details });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const bug = await findBugByIdentifier(identifier);
    if (!bug) {
      return res.status(404).json({ error: `Bug with ID "${identifier}" not found` });
    }

    const count = await InvestigationNote.countDocuments();
    const noteId = `NOTE-${count + 1}-${Date.now().toString().slice(-4)}`;

    const note = await InvestigationNote.create({
      noteId,
      bugId: bug.bugId,
      bug: bug._id,
      userId: req.userId || "dev-user",
      author: (author && author.trim()) || "AI Agent",
      hypothesis: hypothesis ? hypothesis.trim() : "",
      details: details.trim(),
      suggestedFix: suggestedFix ? suggestedFix.trim() : "",
      timestamp: new Date(),
    });

    // Touch bug updatedAt
    await Bug.findByIdAndUpdate(bug._id, { updatedAt: new Date() });

    res.status(201).json({
      ...note.toObject(),
      id: note.noteId,
    });
  } catch (err) {
    console.error("[addInvestigationNote] Error:", err.message);
    res.status(500).json({ error: "Failed to add investigation note" });
  }
}

export async function getPublicForm(req, res) {
  try {
    const { formId } = req.params;
    const form = await findBugByIdentifier(formId);

    if (!form || form.isPublic === false) {
      return res.status(404).json({ error: "Form not found or is private" });
    }

    res.json({
      formId: form.bugId,
      title: form.title,
      description: form.description,
      bugType: form.bugType,
      severity: form.severity,
      priority: form.priority,
      environment: form.environment,
    });
  } catch (err) {
    console.error("[getPublicForm] Error:", err.message);
    res.status(500).json({ error: "Failed to load public form" });
  }
}

export async function submitFeedback(req, res) {
  try {
    const { formId } = req.params;
    const {
      title,
      bugTitle,
      severity,
      bugType,
      bugDescription,
      stepsToReproduce,
      environment,
      reporterEmail,
      attachments,
    } = req.body;

    if (!bugDescription || !bugDescription.trim()) {
      return res.status(400).json({ error: "Bug description is required" });
    }

    if (reporterEmail && !isValidEmail(reporterEmail)) {
      return res.status(400).json({ error: "Invalid reporter email" });
    }

    const form = await findBugByIdentifier(formId);
    if (!form || form.isPublic === false) {
      return res.status(404).json({ error: "Form not found or is not public" });
    }

    const resolvedBugTitle = (bugTitle || title || form.title || "Bug Report").trim();
    const resolvedSeverity = severity || form.severity || "Medium";
    const resolvedBugType = bugType || form.bugType || "UI";

    const submission = await Submission.create({
      userId: form.userId,
      formId: form._id,
      formTitle: form.title,
      bugTitle: resolvedBugTitle,
      bugType: resolvedBugType,
      severity: resolvedSeverity,
      bugDescription: bugDescription.trim(),
      stepsToReproduce: stepsToReproduce || "",
      environment: environment || "",
      reporterEmail: reporterEmail || "",
      attachments: Array.isArray(attachments) ? attachments : [],
      status: "New",
    });

    sendNewBugEmail({
      userId: form.userId,
      title: `${form.title} - ${resolvedBugTitle}`,
      severity: resolvedSeverity,
      description: bugDescription.trim(),
      date: new Date().toLocaleString(),
    }).catch((err) =>
      console.error("Async email dispatch failed:", err.message)
    );

    res.status(201).json({
      message: "Feedback submitted successfully",
      id: submission._id.toString(),
    });
  } catch (err) {
    console.error("[submitFeedback] Error:", err.message);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
}
