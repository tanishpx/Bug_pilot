import "dotenv/config";
import dns from "dns";
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {}
import express from "express";
import cors from "cors";
import { connectDB, isDbConnected } from "./config/db.js";

import bugsRouter from "./routes/bugs.js";
import submissionsRouter from "./routes/submissions.js";
import statsRouter from "./routes/stats.js";
import settingsRouter from "./routes/settings.js";
import insightsRouter from "./routes/insights.js";

const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "https://bugpilotai.vercel.app",
];

if (process.env.ALLOWED_ORIGINS) {
  const extraOrigins = process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  allowedOrigins.push(...extraOrigins);
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "15mb" }));

// Health check endpoints (both /health and /api/health)
const healthHandler = (_req, res) => {
  res.json({
    status: "ok",
    database: isDbConnected() ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// API route handlers
app.use("/api/bugs", bugsRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/insights", insightsRouter);
app.use("/api/settings", settingsRouter);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("[ServerError]", err);
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "Not allowed by CORS" });
  }
  res.status(500).json({ error: "An unexpected error occurred" });
});

// Connect to MongoDB
connectDB().catch((err) => {
  console.warn(
    "[Server] MongoDB connection failed on initial startup. Proceeding with degraded DB state: " +
      err.message
  );
});

import { fileURLToPath } from "url";
import path from "path";

// Only start the listener if run directly (node server/index.js) and not in Vercel
let server = null;
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain && !process.env.VERCEL) {
  server = app.listen(PORT, () => {
    console.log(`BugPilot server running on http://localhost:${PORT}`);
  });
}

export { server };
export default app;
