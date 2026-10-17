// Shared validation / sanitization helpers for the BugPilot API.
// Kept as pure functions (no DB access) so they are easy to unit-test.

export const BUG_TYPES = [
  "UI",
  "Backend",
  "Performance",
  "Security",
  "Database",
  "Runtime",
  "API",
  "Other",
];

export const SEVERITIES = ["Low", "Medium", "High", "Critical"];
export const PRIORITIES = ["P0", "P1", "P2", "P3"];

export const BUG_STATUSES = [
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
];

// Fields that can be created/updated on a Bug document
export const UPDATABLE_BUG_FIELDS = [
  "title",
  "description",
  "bugType",
  "severity",
  "priority",
  "status",
  "assignee",
  "reporter",
  "reporterEmail",
  "environment",
  "stepsToReproduce",
  "logs",
  "relatedFiles",
  "attachments",
  "tags",
  "isPublic",
];

export function pickBugUpdates(body = {}) {
  const updates = {};
  for (const field of UPDATABLE_BUG_FIELDS) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }
  // Support both 'type' and 'bugType' from callers
  if (body.type !== undefined && updates.bugType === undefined) {
    updates.bugType = body.type;
  }
  return updates;
}

// Returns an error message string when fields are invalid, else null.
export function validateBugFields(fields = {}) {
  if (fields.title !== undefined && !String(fields.title).trim()) {
    return "Title is required";
  }
  const effectiveType = fields.bugType || fields.type;
  if (effectiveType !== undefined && !BUG_TYPES.includes(effectiveType)) {
    return `Invalid bugType. Must be one of: ${BUG_TYPES.join(", ")}`;
  }
  if (fields.severity !== undefined && !SEVERITIES.includes(fields.severity)) {
    return `Invalid severity. Must be one of: ${SEVERITIES.join(", ")}`;
  }
  if (fields.priority !== undefined && !PRIORITIES.includes(fields.priority)) {
    return `Invalid priority. Must be one of: ${PRIORITIES.join(", ")}`;
  }
  if (fields.status !== undefined && !BUG_STATUSES.includes(fields.status)) {
    return `Invalid status. Must be one of: ${BUG_STATUSES.join(", ")}`;
  }
  if (fields.tags !== undefined && !Array.isArray(fields.tags)) {
    return "Tags must be an array of strings";
  }
  if (fields.attachments !== undefined && !Array.isArray(fields.attachments)) {
    return "Attachments must be an array";
  }
  if (fields.relatedFiles !== undefined && !Array.isArray(fields.relatedFiles)) {
    return "Related files must be an array of paths";
  }
  if (fields.reporterEmail && !isValidEmail(fields.reporterEmail)) {
    return "Invalid reporter email address";
  }
  return null;
}

export function validateInvestigationNote(body = {}) {
  if (!body.details || !String(body.details).trim()) {
    return "Note details/findings are required";
  }
  return null;
}

// Escape special regex characters so user search input cannot break or slow down MongoDB regex
export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Escape HTML so user-controlled values cannot inject markup into notification emails
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
}
