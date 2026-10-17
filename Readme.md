# Bug Pilot

Bug Pilot is a full-stack bug and feedback management application with integrated AI assistance via Model Context Protocol (MCP). Teams can create bug report forms, share them publicly, review incoming submissions, track issues in real-time from an admin dashboard, log detailed investigation notes, and diagnose issues with AI agents backed by a persistent MongoDB database.

---

## 🎯 Architecture & Features

- **Real Database Persistence**: All bugs and investigation notes persist across server restarts in MongoDB using Mongoose.
- **Full REST API**: Clean CRUD endpoints for bugs (`/api/bugs`), subresource notes (`/api/bugs/:id/notes`), filtering, search, and pagination.
- **Admin Dashboard**: Real-time bug lists, full inspection drawer, search & filters (severity, status, bug type), "+ File New Bug" modal, and investigation note authoring.
- **AI / MCP Integration**: Model Context Protocol (MCP) server connects AI assistants directly to the live database (`DatabaseBugDataSource`) or REST API (`BugPilotApiDataSource`), enabling AI tools to search, analyze, update, and annotate real bug reports.
- **Zero Static Runtime Dependency**: The application and MCP server query the database at runtime—`sample-bugs.json` is used solely as an initial migration/seed source.

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
npm --prefix mcp-server run build
```

Run standalone MCP verification tests (validates stdio connection, tool execution against database, notes, and prompt schemas):

```bash
npm --prefix mcp-server test
```

Start the MCP server with stdio transport:

```bash
npm --prefix mcp-server start
```

### 7. Running Automated Test Suite

Run the full end-to-end integration test suite covering database connections, bug CRUD, search/filtering, validation errors, investigation notes, and MCP tools:

```bash
npm test
```

---

## 🔌 AI Assistant / MCP Client Integration

Configure Claude Desktop, Cursor, Antigravity, or Windsurf to use Bug Pilot's MCP server:

```json
{
  "mcpServers": {
    "bug-pilot": {
      "command": "node",
      "args": [
        "path/to/Bug_Pilot/mcp-server/dist/index.js"
      ],
      "env": {
        "DATA_SOURCE_MODE": "database",
        "MONGODB_URI": "your-mongodb-connection-string"
      }
    }
  }
}
```

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

