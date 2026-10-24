import {
  getSettings as readSettings,
  updateSettings as writeSettings,
  SettingsError,
} from "../services/settingsService.js";
import { getMcpStatus } from "../services/mcpStatusService.js";

function resolveApiUrl(req) {
  if (process.env.MCP_API_URL) return process.env.MCP_API_URL;
  if (process.env.BUG_PILOT_API_URL) return process.env.BUG_PILOT_API_URL;
  return `${req.protocol}://${req.get("host")}/api`;
}

// One load/save interface for the Settings page. MCP status is composed here so
// the page does not orchestrate a second endpoint.
function buildResponse(req, settings) {
  return {
    settings,
    mcp: getMcpStatus({
      userId: req.userId,
      apiUrl: resolveApiUrl(req),
      enabled: settings.mcpEnabled,
    }),
  };
}

function sendError(res, label, err, fallback) {
  if (err instanceof SettingsError) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(`[${label}] Error:`, err.message);
  return res.status(500).json({ error: fallback });
}

export async function getSettings(req, res) {
  try {
    const settings = await readSettings(req.userId);
    res.json(buildResponse(req, settings));
  } catch (err) {
    sendError(res, "getSettings", err, "Failed to load settings");
  }
}

export async function updateSettings(req, res) {
  try {
    const settings = await writeSettings(req.userId, req.body);
    res.json(buildResponse(req, settings));
  } catch (err) {
    sendError(res, "updateSettings", err, "Failed to update settings");
  }
}
