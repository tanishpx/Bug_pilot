import Submission from "../models/Submission.js";
import { sendNewBugEmail } from "../services/emailService.js";
import * as bugService from "../services/bugService.js";
import { BugServiceError } from "../services/bugService.js";
import { isValidEmail } from "../utils/validation.js";

function sendError(res, label, err, fallback) {
  if (err instanceof BugServiceError) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(`[${label}] Error:`, err.message);
  return res.status(500).json({ error: fallback });
}

function identifierFrom(req) {
  return req.params.id || req.params.formId;
}

export async function getBugs(req, res) {
  try {
    const bugs = await bugService.listBugs({ ...req.query, userId: req.userId });
    res.json(bugs);
  } catch (err) {
    sendError(res, "getBugs", err, "Failed to retrieve bugs");
  }
}

export async function getBugById(req, res) {
  try {
    const bug = await bugService.getBug(identifierFrom(req));
    res.json(bug);
  } catch (err) {
    sendError(res, "getBugById", err, "Failed to retrieve bug details");
  }
}

export async function createBug(req, res) {
  try {
    const bug = await bugService.createBug(req.body, req.userId);
    res.status(201).json(bug);
  } catch (err) {
    sendError(res, "createBug", err, "Failed to create bug");
  }
}

export async function updateBug(req, res) {
  try {
    const bug = await bugService.updateBug(identifierFrom(req), req.body);
    res.json(bug);
  } catch (err) {
    sendError(res, "updateBug", err, "Failed to update bug");
  }
}

export async function deleteBug(req, res) {
  try {
    const result = await bugService.deleteBug(identifierFrom(req));
    res.json(result);
  } catch (err) {
    sendError(res, "deleteBug", err, "Failed to delete bug");
  }
}

export async function getInvestigationNotes(req, res) {
  try {
    const notes = await bugService.getInvestigationNotes(identifierFrom(req));
    res.json(notes);
  } catch (err) {
    sendError(res, "getInvestigationNotes", err, "Failed to retrieve investigation notes");
  }
}

export async function addInvestigationNote(req, res) {
  try {
    const note = await bugService.addInvestigationNote(
      identifierFrom(req),
      req.body,
      req.userId
    );
    res.status(201).json(note);
  } catch (err) {
    sendError(res, "addInvestigationNote", err, "Failed to add investigation note");
  }
}

export async function getPublicForm(req, res) {
  try {
    const form = await bugService.findBugByIdentifier(req.params.formId);

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
    sendError(res, "getPublicForm", err, "Failed to load public form");
  }
}

export async function submitFeedback(req, res) {
  try {
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

    const form = await bugService.findBugByIdentifier(req.params.formId);
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
    sendError(res, "submitFeedback", err, "Failed to submit feedback");
  }
}
