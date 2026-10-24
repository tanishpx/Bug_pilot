# Bug Pilot

Bug Pilot is a full-stack bug and feedback management application with integrated AI assistance via Model Context Protocol (MCP). Teams can create bug report forms, share them publicly, review incoming submissions, track issues in real-time from an admin dashboard, log detailed investigation notes, and diagnose issues with AI agents backed by a persistent MongoDB database.

---

## 🎯 Architecture & Features

- **Real Database Persistence**: All bugs and investigation notes persist across server restarts in MongoDB using Mongoose.
- **Full REST API**: Clean CRUD endpoints for bugs (`/api/bugs`), subresource notes (`/api/bugs/:id/notes`), filtering, search, and pagination.
- **Admin Dashboard**: Real-time bug lists, full inspection drawer, search & filters (severity, status, bug type), "+ File New Bug" modal, and investigation note authoring.
- **AI / MCP Integration**: Model Context Protocol (MCP) server connects AI assistants to the live Bug Pilot REST API (`BugPilotApiDataSource`). The API is the single Bug module: it owns validation, lifecycle transitions, and persistence.
- **Settings Seam**: Workspace settings, notification policy, and MCP status load and save through one `/api/settings` interface. The MCP enable toggle is enforced at the API seam, not just hidden in the UI.
- **Zero Static Runtime Dependency**: The application queries the database at runtime; the MCP server queries the API at runtime. `sample-bugs.json` is used solely as an initial migration/seed source.

---

## 🚀 Getting Started

### 1. Requirements

- Node.js 18+
- MongoDB instance (MongoDB Atlas or local `mongodb://localhost:27017/bugpilot`)
- npm or pnpm

### 2. Configure Environment (`.env`)

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Ensure your `.env` contains:

```env
# MongoDB Atlas or local connection string
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/bugpilot

# Express server port
PORT=3001

# Frontend API URL
VITE_API_URL=http://localhost:3001/api

# Firebase Config (for Admin Authentication)
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:xxxxxxxxxxxx

# Admin access
VITE_ADMIN_EMAILS=admin@example.com
```

### 3. Install Dependencies

```bash
# Install main application dependencies
npm install

# Install MCP server dependencies
npm --prefix mcp-server install
```

### 4. Database Migrations & Seeding

Run the migration script to synchronize schema indexes and migrate legacy collections:

```bash
npm run db:migrate
```

Seed development users, standard bugs (`BUG-101`, `BUG-102`, `BUG-103`), and investigation notes from `sample-bugs.json`:

```bash
npm run db:seed
```

### 5. Running the Application

Start the Express API and Vite frontend concurrently:

```bash
npm run dev
```

Or run them individually in separate terminals:

```bash
# Terminal 1: Express API (http://localhost:3001)
npm run dev:server

# Terminal 2: Vite React Frontend (http://localhost:5173)
npm run dev:frontend
```

Verify backend health:
- `GET http://localhost:3001/health`
- `GET http://localhost:3001/api/health`

### 6. Running and Building the MCP Server

Build the TypeScript distribution:

```bash
npm run mcp:build
```

Run the MCP verification suite. It creates a temporary bug through the MCP
interface, exercises every tool, resource, and prompt, compares the registered
catalog to `mcp.manifest.json`, rejects unknown IDs and invalid input, checks
that startup fails fast against an unreachable API, then deletes the fixture. A
failed cleanup fails the run. The API server must be running (the MCP server is
an API client, not a database client):

```bash
npm run mcp:test
```

Start the MCP server with stdio transport:

```bash
npm run mcp:start
```

### 7. Running Automated Test Suite

Run the full end-to-end integration test suite covering database connections, bug CRUD, search/filtering, validation errors, investigation notes, and MCP tools:

```bash
npm test
```

---

## 🔌 AI Assistant / MCP Client Integration

Open **Settings → AI Assistant (MCP)** in the admin console. The Settings page
loads workspace settings and MCP status through one `/api/settings` request.
That card:

- shows whether the MCP server build is ready and the API database is connected;
- lists the tools the assistant can call;
- generates a ready-to-paste client configuration for the current API URL and admin user;
- enables or disables MCP access. When disabled, the API rejects MCP-originated
  requests with `403` (the toggle is enforced, not cosmetic).

The generated configuration points the MCP server at the Express API, so the
server reuses the API's validation and never needs database credentials of its
own:

```json
{
  "mcpServers": {
    "bug-pilot": {
      "command": "node",
      "args": ["/absolute/path/to/Bug_Pilot/mcp-server/dist/index.js"],
      "env": {
        "BUG_PILOT_API_URL": "http://localhost:3001/api",
        "BUG_PILOT_USER_ID": "your-admin-user-id"
      }
    }
  }
}
```

There is no direct-database mode. Start the API before the MCP server; the MCP
server fails fast with a clear error if the API is unreachable.

Available MCP Tools:
- `get_bug_context`: Fetches complete context (logs, steps, environment, notes) for a bug ID.
- `list_bugs`: Searches/filters real bugs by status, severity, type, or keyword.
- `create_bug_report`: Creates a new persistent bug record in the database.
- `add_investigation_note`: Records diagnostic hypotheses and fix proposals.
- `update_bug_status`: Updates status (`New`, `In Progress`, `Resolved`, `Closed`).

---

## 🛠️ API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | System and MongoDB connectivity status |
| `GET` | `/api/bugs` | List bugs with filters (`status`, `severity`, `type`, `search`, `page`, `limit`) |
| `GET` | `/api/bugs/:id` | Get single bug by `bugId` (e.g. `BUG-101`) or MongoDB `_id` |
| `POST` | `/api/bugs` | Create a new bug report |
| `PUT` | `/api/bugs/:id` | Update bug details or status |
| `DELETE` | `/api/bugs/:id` | Delete bug report and associated investigation notes |
| `GET` | `/api/bugs/:id/notes` | Get all investigation notes for a bug |
| `POST` | `/api/bugs/:id/notes` | Add an investigation note to a bug |
| `GET` | `/api/settings` | Load workspace settings and derived MCP status |
| `PUT` | `/api/settings` | Update workspace settings (partial updates supported) |

