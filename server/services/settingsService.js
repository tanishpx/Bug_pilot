import Settings from "../models/Settings.js";

// Settings is the workspace policy module: it owns defaults, validation,
// persistence, notification preferences, and the MCP enablement decision.
// Controllers, middleware, and the email pipeline are callers of this interface.

export class SettingsError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "SettingsError";
    this.status = status;
  }
}

export const DEFAULT_SETTINGS = Object.freeze({
  newBugNotifications: false,
  statusChangeNotifications: false,
  notificationEmail: "",
  applicationName: "BugPilot",
  supportEmail: "support@bugpilot.com",
  theme: "System",
  primaryColor: "#7c3aed",
  mcpEnabled: true,
});

const UPDATABLE_FIELDS = [
  "newBugNotifications",
  "statusChangeNotifications",
  "notificationEmail",
  "applicationName",
  "supportEmail",
  "theme",
  "primaryColor",
  "mcpEnabled",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const THEMES = new Set(["Light", "Dark", "System"]);

function normalize(userId, doc) {
  const source = doc || {};

  return {
    userId,
    newBugNotifications:
      source.newBugNotifications ?? DEFAULT_SETTINGS.newBugNotifications,
    statusChangeNotifications:
      source.statusChangeNotifications ?? DEFAULT_SETTINGS.statusChangeNotifications,
    notificationEmail: source.notificationEmail ?? DEFAULT_SETTINGS.notificationEmail,
    applicationName: source.applicationName ?? DEFAULT_SETTINGS.applicationName,
    supportEmail: source.supportEmail ?? DEFAULT_SETTINGS.supportEmail,
    theme: source.theme ?? DEFAULT_SETTINGS.theme,
    primaryColor: source.primaryColor ?? DEFAULT_SETTINGS.primaryColor,
    mcpEnabled: source.mcpEnabled ?? DEFAULT_SETTINGS.mcpEnabled,
  };
}

function pickUpdates(input = {}) {
  const updates = {};

  for (const field of UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field) && input[field] !== undefined) {
      updates[field] = input[field];
    }
  }

  return updates;
}

function validate(updates) {
  if (updates.notificationEmail && !EMAIL_REGEX.test(updates.notificationEmail)) {
    throw new SettingsError(400, "Invalid notification email address");
  }

  if (updates.supportEmail && !EMAIL_REGEX.test(updates.supportEmail)) {
    throw new SettingsError(400, "Invalid support email address");
  }

  if (updates.theme !== undefined && !THEMES.has(updates.theme)) {
    throw new SettingsError(400, "Invalid theme");
  }

  if (updates.mcpEnabled !== undefined && typeof updates.mcpEnabled !== "boolean") {
    throw new SettingsError(400, "MCP access must be a boolean");
  }
}

export async function getSettings(userId) {
  const doc = await Settings.findOne({ userId }).lean();
  return normalize(userId, doc);
}

export async function updateSettings(userId, input = {}) {
  const updates = pickUpdates(input);
  validate(updates);

  const doc = await Settings.findOneAndUpdate(
    { userId },
    { $set: updates },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    }
  ).lean();

  return normalize(userId, doc);
}

// The MCP access decision belongs here, not in the middleware. A missing
// settings document means the default (enabled).
export async function isMcpEnabled(userId) {
  const doc = await Settings.findOne({ userId }, { mcpEnabled: 1 }).lean();
  return doc?.mcpEnabled !== false;
}

// The email pipeline asks Settings for its delivery policy instead of reading
// the model directly.
export async function getNotificationSettings(userId) {
  const settings = await getSettings(userId);

  return {
    newBugEnabled: settings.newBugNotifications === true,
    statusChangeEnabled: settings.statusChangeNotifications === true,
    to: settings.notificationEmail || settings.supportEmail || "admin@example.com",
    appName: settings.applicationName || "BugPilot",
  };
}
