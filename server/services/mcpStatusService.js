import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { isDbConnected } from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MCP_SERVER_PATH =
  process.env.MCP_SERVER_PATH ||
  path.resolve(__dirname, "../../mcp-server/dist/index.js");
const MCP_MANIFEST_PATH =
  process.env.MCP_MANIFEST_PATH ||
  path.resolve(__dirname, "../../mcp-server/mcp.manifest.json");

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MCP_MANIFEST_PATH, "utf8"));
  } catch {
    return { tools: [], resources: [], prompts: [] };
  }
}

// Derived, read-only view of the MCP integration. The Settings module composes
// this with workspace settings; callers do not need to know where the manifest
// lives or how the build path is resolved.
export function getMcpStatus({ userId, apiUrl, enabled }) {
  const manifest = readManifest();

  return {
    enabled: enabled !== false,
    transport: manifest.transport || "stdio",
    dataSourceMode: "bugpilot_api",
    database: isDbConnected() ? "connected" : "disconnected",
    server: {
      path: MCP_SERVER_PATH,
      built: fs.existsSync(MCP_SERVER_PATH),
      command: "node",
    },
    clientConfig: {
      mcpServers: {
        "bug-pilot": {
          command: "node",
          args: [MCP_SERVER_PATH],
          env: {
            BUG_PILOT_API_URL: apiUrl,
            BUG_PILOT_USER_ID: userId,
          },
        },
      },
    },
    capabilities: manifest,
  };
}
