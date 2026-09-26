// Shared validation / sanitization helpers for the BugPilot API.
// Kept as pure functions (no DB access) so they are easy to unit-test.

export const BUG_TYPES = ["UI", "Runtime", "Performance", "Security", "API", "Other"];
export const SEVERITIES = ["Low", "Medium", "High", "Critical"];
export const PRIORITIES = ["P0", "P1", "P2", "P3"];
export const BUG_STATUSES = [
  "Open",
  "Triaged",
  "Assigned",
  "In Progress",
  "Resolved",
  "Fixed",
  "Retest",
  "Closed",
  "Reopened",
];

// Only these fields may be changed through PUT /api/bugs/:formId.
// Everything else in the request body (userId, formId, _id, resolvedAt,
// createdAt, ...) is ignored to prevent mass-assignment.
export const UPDATABLE_BUG_FIELDS = [
  "title",
  "description",
  "bugType",
  "severity",
  "priority",
  "status",
  "assignee",
  "reporter",
  "environment",
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
  return updates;
}

// Returns an error message string when the fields are invalid, else null.
export function validateBugFields(fields = {}) {
  if (fields.title !== undefined && !String(fields.title).trim()) {
    return "Title is required";
  }
  if (fields.bugType !== undefined && !BUG_TYPES.includes(fields.bugType)) {
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
    return "Tags must be an array";
  }
  return null;
}

// Escape special regex characters so user search input cannot break or
// slow down the MongoDB $regex query.
export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Escape HTML so user-controlled values cannot inject markup into the
// notification emails (which are sent as HTML).
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
