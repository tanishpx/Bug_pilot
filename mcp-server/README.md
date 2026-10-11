# Bug Pilot MCP Server (Model Context Protocol)

Standalone Model Context Protocol (MCP) server that empowers AI assistants to understand, investigate, and diagnose bug reports with rich contextual details (error logs, reproduction steps, runtime environment, suspected files, and prior investigation notes).

---

## 🎯 Purpose & Design

- **Isolated & Standalone**: Operates independently in `mcp-server/` with its own dependencies and mock/in-memory data store. It does **not** alter or depend on the main Bug Pilot MongoDB/Express backend for now.
- **AI-Optimized Context**: Returns bug reports structured specifically for debugging agents, including reproduction steps, stack traces, hypotheses, and diagnostic checklists.
- **Plug-and-Play Bridge for Later**: Features a clean `IBugDataSource` abstraction so you can switch from standalone mode to live Bug Pilot API (`http://localhost:3001/api`) with a single environment flag whenever you're ready.

---

## 📁 Project Structure

```
mcp-server/
├── src/
│   ├── index.ts                     # Main entrypoint; registers tools, resources, prompts & stdio transport
│   ├── types/
│   │   └── bug.ts                   # Types: BugReport, BugSeverity, BugStatus, InvestigationNote, etc.
│   ├── data/
│   │   ├── sample-bugs.json         # Realistic initial bug datasets (UI crash, auth 500, database timeout)
│   │   └── storage.ts               # IBugDataSource interface, StandaloneBugDataSource, & Api stub
│   ├── tools/
│   │   ├── getBugContext.ts         # `get_bug_context`: Returns rich, AI-optimized debugging context
│   │   ├── listBugs.ts              # `list_bugs`: Filter by status, severity, type, or search term
│   │   ├── createBug.ts             # `create_bug_report`: Submit new bug context into store
│   │   ├── addInvestigationNote.ts  # `add_investigation_note`: Log AI hypotheses and fix suggestions
│   │   └── updateBugStatus.ts       # `update_bug_status`: Move bug across lifecycle states
│   ├── resources/
│   │   └── bugResources.ts          # Resources: `bugs://all` and `bugs://{id}`
│   └── prompts/
│       └── investigateBugPrompt.ts  # Guided AI workflow prompt `investigate_bug`
├── dist/                            # Compiled JavaScript distribution
├── test-server.ts                   # End-to-end client verification script
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 🛠️ Exposed MCP Capabilities

### Tools
| Tool | Description | Key Arguments |
|------|-------------|---------------|
| `get_bug_context` | Retrieves comprehensive, AI-optimized context for a bug report | `bugId` (e.g. `"BUG-101"`) |
| `list_bugs` | Lists bugs with optional filtering | `status`, `severity`, `type`, `search`, `limit` |
| `create_bug_report` | Files a new bug report into the store | `title`, `description`, `type`, `severity`, `stepsToReproduce`, `environment`, `logs`, `relatedFiles` |
| `add_investigation_note` | Records an AI hypothesis, technical note, or proposed fix | `bugId`, `hypothesis`, `details`, `suggestedFix`, `author` |
| `update_bug_status` | Updates bug lifecycle state | `bugId`, `status` (`"New"`, `"In Progress"`, `"Resolved"`, etc.) |

### Resources
- `bugs://all` — Full JSON payload of all currently tracked bug reports.
- `bugs://{id}` — Raw JSON payload of an individual bug report by ID.

### Prompts
- `investigate_bug` — Interactive prompt guiding an AI agent through a systematic 5-step root-cause analysis workflow.

---

## 🚀 Getting Started

### 1. Install & Build

```bash
cd mcp-server
npm install
npm run build
```

### 2. Run Standalone Tests

Verify that the MCP server starts, connects via stdio, and responds to all tool calls:

```bash
npm test
```

### 3. Development Mode

Run directly with TypeScript hot-execution:

```bash
npm run dev
```

---

## 🔌 Connecting to AI Clients

To use this MCP server with your AI assistant (e.g., Claude Desktop, Antigravity, Cursor, Windsurf, or MCP Inspector):

### Configuration snippet (`mcpServers`)

```json
{
  "mcpServers": {
    "bug-pilot": {
      "command": "node",
      "args": [
        "/home/tanish4181/Projects/Bug_Pilot/mcp-server/dist/index.js"
      ],
      "env": {
        "DATA_SOURCE_MODE": "standalone"
      }
    }
  }
}
```

---

## 🔗 Blueprint for Connecting to the Main Project Later

When you are ready to connect this MCP server to the live Bug Pilot Express API or MongoDB database:

1. **Update `.env`**:
   ```env
   DATA_SOURCE_MODE=bugpilot_api
   BUG_PILOT_API_URL=http://localhost:3001/api
   ```
2. **Implement `BugPilotApiDataSource` in `src/data/storage.ts`**:
   - `getAll()` ➔ `fetch(`${this.apiUrl}/submissions`)`
   - `getById(id)` ➔ `fetch(`${this.apiUrl}/submissions/${id}`)`
   - `updateStatus(id, status)` ➔ `fetch(`${this.apiUrl}/submissions/${id}/status`, { method: 'PATCH', ... })`
   - `addInvestigationNote(input)` ➔ `fetch(`${this.apiUrl}/submissions/${input.bugId}/notes`, { method: 'POST', ... })`
3. Everything else (tools, prompts, AI schemas) will continue working seamlessly without any changes to the AI client interface.
