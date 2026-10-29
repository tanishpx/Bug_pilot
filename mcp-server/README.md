# Bug Pilot 🪲🚀

Bug Pilot is a full-stack bug and feedback management application with integrated AI assistance via Model Context Protocol (MCP) and full-stack observability with Prometheus and Grafana.

Teams can create public bug report forms, triage submissions in real-time on an admin dashboard, record detailed investigation notes, diagnose issues with AI agents backed by MongoDB, and monitor server performance and health metrics through Grafana.

---

## ⚡ Quickstart

Choose your preferred setup method:

### Option A: Docker (Fastest — One Command)

Run the complete full-stack environment (Frontend, Backend, Prometheus, Grafana) with Docker Compose:

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Start all containers
docker compose up -d
```

| Service | URL | Default Credentials |
| :--- | :--- | :--- |
| **Frontend App** | [http://localhost:8080](http://localhost:8080) | — |
| **Backend API** | [http://localhost:3001](http://localhost:3001) | — |
| **Grafana Dashboard** | [http://localhost:3000](http://localhost:3000) | `admin` / `admin` |
| **Prometheus Metrics** | [http://localhost:9090](http://localhost:9090) | — |

---

### Option B: Local Node.js Development

#### 1. Prerequisites
- Node.js 18+ & npm
- MongoDB instance (MongoDB Atlas or local `mongodb://localhost:27017/bugpilot`)

#### 2. Install & Configure
```bash
# Clone and enter repo
git clone https://github.com/tanishpx/Bug_pilot.git
cd Bug_Pilot

# Copy environment variables
cp .env.example .env

# Install dependencies (app & MCP server)
npm install
npm --prefix mcp-server install
```

#### 3. Seed Database & Start
```bash
# Seed development data and indexes
npm run db:seed

# Start both backend and frontend concurrently
npm run dev
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3001](http://localhost:3001)
- **Health Check**: [http://localhost:3001/api/health](http://localhost:3001/api/health)

---

## 📊 Observability & Monitoring (Grafana + Prometheus)

Bug Pilot features built-in APM (Application Performance Monitoring) and telemetry:

- **Metrics Instrumentation**: Express middleware in `server/middleware/metrics.js` tracks request throughput, response latency histograms (p50/p95/p99), status code distributions, active in-flight requests, and Node.js process internals (heap memory, event loop lag, CPU load).
- **Metrics Endpoint**: Exposed at `GET /metrics` in Prometheus format.
- **Auto-Provisioning**: Grafana automatically loads the datasource and pre-built dashboard on startup.

### Running Monitoring Only
```bash
docker compose -f monitoring/docker-compose.monitoring.yml up -d
```
Access Grafana at [http://localhost:3000](http://localhost:3000).

### Dashboard Previews

#### Light Mode
![Grafana Dashboard Light Mode](monitoring/assets/grafana-dashboard-light.png)

#### Dark Mode
![Grafana Dashboard Dark Mode](monitoring/assets/grafana-dashboard-screenshot.png)

---

## 🔌 AI Assistant (MCP) Integration

Bug Pilot integrates Model Context Protocol (MCP) to let AI assistants (Claude Code, Cursor, Antigravity, etc.) triage, inspect, and update bugs directly through the REST API.

1. Open **Settings → AI Assistant (MCP)** in the Admin Console.
2. The Settings panel displays live MCP build readiness, database status, and generates client configuration:

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

### Available MCP Tools
- `get_bug_context`: Fetches complete defect context (environment, logs, steps, notes).
- `list_bugs`: Searches/filters bugs by status, severity, or keyword.
- `create_bug_report`: Creates a new persistent bug record.
- `add_investigation_note`: Appends diagnostic hypotheses and fix proposals.
- `update_bug_status`: Transitions bug lifecycles (`New`, `In Progress`, `Resolved`, `Closed`).

---

## 📄 Automated Report Generation

Generate formatted PDF progress reports directly from Git commit telemetry:

```bash
# Generate full project report (captures all commits across history)
.venv/bin/python generate_reports.py final

# Generate weekly report (last 7 days)
.venv/bin/python generate_reports.py weekly

# Generate monthly report (last 30 days)
.venv/bin/python generate_reports.py monthly
```
*Generated reports are saved in the project root as `Bug_Pilot_<Interval>_Report_<Date>.pdf`.*

---

## 🧪 Testing & Verification

Run the full end-to-end automated test suite:

```bash
# Run backend & database integration tests
npm test

# Run MCP test suite
npm run mcp:test

# TypeScript typecheck
npm run typecheck

# Production build
npm run build
```

---

## 🛠️ API Reference

| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/health` | Health check & MongoDB connection status |
| `GET` | `/metrics` | Prometheus metrics endpoint |
| `GET` | `/api/bugs` | List bugs with filters (`status`, `severity`, `type`, `search`) |
| `GET` | `/api/bugs/:id` | Get single bug by ID (e.g. `BUG-101`) or MongoDB `_id` |
| `POST` | `/api/bugs` | Create a new bug report |
| `PUT` | `/api/bugs/:id` | Update bug details or status |
| `DELETE` | `/api/bugs/:id` | Delete bug report and associated investigation notes |
| `GET` | `/api/bugs/:id/notes` | Get all investigation notes for a bug |
| `POST` | `/api/bugs/:id/notes` | Add an investigation note to a bug |
| `GET` | `/api/stats` | Aggregate dashboard statistics (status, severity, counts) |
| `GET` | `/api/settings` | Load workspace settings and derived MCP status |
| `PUT` | `/api/settings` | Update workspace settings |

---

## 📂 Project Structure

```
Bug_Pilot/
├── Dockerfile                  # Frontend container build (Nginx SPA)
├── Dockerfile.backend          # Backend container build (Node 20 Alpine)
├── docker-compose.yml          # Full-stack orchestrator
├── nginx.conf                  # Nginx client-side routing config
├── generate_reports.py         # Automated PDF report generator
├── monitoring/                 # Monitoring & Observability
│   ├── docker-compose.monitoring.yml
│   ├── prometheus.yml          # Prometheus scrape configuration
│   ├── provisioning/           # Auto-provisioned Grafana datasources & dashboard
│   └── assets/                 # Dashboard screenshots (Light/Dark mode)
├── mcp-server/                 # Model Context Protocol (MCP) server
├── server/                     # Express REST API & MongoDB models
│   ├── controllers/            # Route controllers
│   ├── middleware/             # Auth, MCP access, & Prometheus metrics
│   ├── models/                 # Mongoose schemas
│   └── routes/                 # API route declarations
└── src/                        # Vite + React Admin Dashboard
```