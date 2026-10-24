# Bug Pilot MCP Server (Model Context Protocol)

Standalone Model Context Protocol (MCP) server that empowers AI assistants to understand, investigate, and diagnose bug reports with rich contextual details (error logs, reproduction steps, runtime environment, suspected files, and prior investigation notes).

---

## 🎯 Purpose & Design

- **API-Backed & Live**: Operates on live Bug Pilot REST API records. The API owns the database, validation, lifecycle transitions, and persistence; the MCP server owns only the AI-facing interface.
- **AI-Optimized Context**: Returns bug reports structured specifically for debugging agents, including reproduction steps, stack traces, hypotheses, and diagnostic checklists.
- **Single Bug Module**: The MCP server implements `IBugDataSource` with `BugPilotApiDataSource`, a client of the Express API. It has no Mongoose schema and no direct MongoDB connection, so the API's rules cannot be bypassed.

---

## 📁 Project Structure

```
mcp-server/
├── src/
│   ├── index.ts                     # Main entrypoint; registers tools, resources, prompts & stdio transport
│   ├── config/
│   │   └── env.ts                   # Deterministic .env loading from any working directory
│   ├── types/
│   │   └── bug.ts                   # Types: BugReport, BugSeverity, BugStatus, InvestigationNote, etc.
│   ├── data/
│   │   ├── sample-bugs.json         # Realistic initial bug datasets (UI crash, auth 500, database timeout)
│   │   └── storage.ts               # IBugDataSource + BugPilotApiDataSource (REST client)
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
cp .env.example .env
npm run build
```

`BUG_PILOT_API_URL` defaults to `http://localhost:3001/api`, so `.env` is optional
when the API runs on the default port.

### 2. Run Standalone Tests

Start the Bug Pilot API first (from the repository root: `npm run dev:server`).
The MCP server is an API client, so the API must be reachable.

Verify that the MCP server starts, connects via stdio, and responds to all tool calls:

```bash
npm test
```

The verification asserts and exits non-zero on failure; it does not just print
diagnostics. It creates a temporary bug through the MCP tool, reads it back
through every tool, resource, and prompt, compares the registered catalog to
`mcp.manifest.json`, rejects unknown IDs and invalid input, checks that startup
fails fast against an unreachable API, and deletes the fixture through the REST
seam. A failed cleanup fails the run.

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
        "BUG_PILOT_API_URL": "http://localhost:3001/api",
        "BUG_PILOT_USER_ID": "your-admin-user-id"
      }
    }
  }
}
```

---

## 🔗 Architecture: the API is the Bug module

The MCP server does not talk to MongoDB. It calls the Express API, which is the
single owner of Bug validation, identifier lookup, lifecycle transitions,
investigation notes, and persistence. This means:

- `BUG_PILOT_API_URL` must point at a running API (default `http://localhost:3001/api`).
- The MCP server fails fast at startup if the API is unreachable.
- MCP-originated requests carry `X-MCP-Agent: bug-pilot-mcp`; the API can reject
  them when the admin disables MCP in **Settings → AI Assistant (MCP)**.
- No `MONGODB_URI` or `DATA_SOURCE_MODE` is needed in the MCP client environment.

### API contract used by the client

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/bugs` | List/search bugs |
| `GET` | `/bugs/:id` | Fetch one bug with investigation notes |
| `POST` | `/bugs` | Create a bug |
| `PUT` | `/bugs/:id` | Update status or fields |
| `POST` | `/bugs/:id/notes` | Append an investigation note |
| `DELETE` | `/bugs/:id` | Delete a verification fixture |
