import FeedbackForm from "../models/FeedbackForm.js";
import Submission from "../models/Submission.js";
import { sendNewBugEmail, sendStatusChangeEmail } from "../services/emailService.js";
import {
  escapeRegExp,
  isValidEmail,
  pickBugUpdates,
  validateBugFields,
} from "../utils/validation.js";


export async function getBugs(req, res) {
  try {
    const { status, severity, priority, bugType, search } = req.query;
    const filter = { userId: req.userId };

    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (priority) filter.priority = priority;
    if (bugType) filter.bugType = bugType;
    if (search) {
      const safeSearch = escapeRegExp(search);
      filter.$or = [
        { title: { $regex: safeSearch, $options: "i" } },
        { description: { $regex: safeSearch, $options: "i" } },
        { assignee: { $regex: safeSearch, $options: "i" } },
      ];
    }

    const bugs = await FeedbackForm.find(filter).sort({ updatedAt: -1 });
    res.json(bugs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function createBug(req, res) {
  try {
    const {
      title,
      description,
      bugType,
      severity,
      priority,
      assignee,
      reporter,
      environment,
      tags,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    const validationError = validateBugFields({ bugType, severity, priority });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const formId = `BUG-${Date.now()}`;

    const bug = await FeedbackForm.create({
      userId: req.userId,
      formId,
      title: title.trim(),
      description: description || "",
      bugType: bugType || "UI",
      severity: severity || "Medium",
      priority: priority || "P2",
      status: "Open",
      assignee: (assignee && assignee.trim()) || "Unassigned",
      reporter: reporter || "",
      environment: environment || "",
      tags: tags || [],
    });

    res.status(201).json(bug);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateBug(req, res) {
  try {
    const { formId } = req.params;
    // Whitelist updatable fields so callers cannot overwrite userId,
    // formId, resolvedAt or other internal fields (mass-assignment).
    const updates = pickBugUpdates(req.body);

    const validationError = validateBugFields(updates);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (updates.title !== undefined) {
      updates.title = updates.title.trim();
    }

    const originalBug = await FeedbackForm.findOne({ formId, userId: req.userId });
    if (!originalBug) {
      return res.status(404).json({ error: "Bug not found" });
    }

    const previousStatus = originalBug.status;

    if (
      updates.status &&
      ["Resolved", "Fixed", "Closed"].includes(updates.status) &&
      !["Resolved", "Fixed", "Closed"].includes(previousStatus)
    ) {
      updates.resolvedAt = new Date();
    }

    const bug = await FeedbackForm.findOneAndUpdate(
      { formId, userId: req.userId },
      { ...updates, updatedAt: new Date() },
      { new: true }
    );

    if (updates.status && updates.status !== previousStatus) {
      sendStatusChangeEmail({
        userId: req.userId,
        title: bug.title,
        previousStatus,
        newStatus: bug.status,
        date: new Date().toLocaleString(),
      }).catch(err => console.error("Async status change email dispatch failed:", err));
    }

    res.json(bug);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}


export async function deleteBug(req, res) {
  try {
    const { formId } = req.params;
    const bug = await FeedbackForm.findOneAndDelete({
      formId,
      userId: req.userId,
    });

    if (!bug) {
      return res.status(404).json({ error: "Bug not found" });
    }

    await Submission.deleteMany({ formId: bug._id, userId: req.userId });

    res.json({ message: "Bug deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getPublicForm(req, res) {
  try {
    const { formId } = req.params;
    const form = await FeedbackForm.findOne({ formId, isPublic: true });

    if (!form) {
      return res.status(404).json({ error: "Form not found" });
    }

    res.json({
      formId: form.formId,
      title: form.title,
      description: form.description,
      bugType: form.bugType,
      severity: form.severity,
      priority: form.priority,
      environment: form.environment,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      return res
        .status(400)
        .json({ error: "Bug description is required" });
    }

    if (reporterEmail && !isValidEmail(reporterEmail)) {
      return res.status(400).json({ error: "Invalid reporter email" });
    }

    // Only public forms accept anonymous submissions, mirroring getPublicForm.
    const form = await FeedbackForm.findOne({ formId, isPublic: true });

    if (!form) {
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

    // Fire email notification asynchronously so failures do not block the request
    sendNewBugEmail({
      userId: form.userId,
      title: `${form.title} - ${resolvedBugTitle}`,
      severity: resolvedSeverity,
      description: bugDescription.trim(),
      date: new Date().toLocaleString(),
    }).catch(err => console.error("Async email dispatch failed:", err));

    res.status(201).json({
      message: "Feedback submitted successfully",
      id: submission._id,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
