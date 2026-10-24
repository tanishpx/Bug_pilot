import { isMcpEnabled } from "../services/settingsService.js";

const MCP_AGENT = "bug-pilot-mcp";

// Requests from the MCP server identify themselves with X-MCP-Agent. Honor the
// enable/disable toggle stored in Settings so the control in the UI actually
// governs API access instead of being decorative. The decision itself lives in
// the Settings module.
export async function requireMcpAccess(req, res, next) {
  const agent = String(req.headers["x-mcp-agent"] || "").toLowerCase();
  if (agent !== MCP_AGENT) {
    return next();
  }

  const userId = req.headers["x-user-id"] || "dev-user";
  req.userId = userId;

  try {
    if (!(await isMcpEnabled(userId))) {
      return res.status(403).json({
        error:
          "MCP access is disabled for this workspace. Enable it in Settings → AI Assistant.",
      });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}
