import "dotenv/config";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import bugsRouter from "./routes/bugs.js";
import submissionsRouter from "./routes/submissions.js";
import statsRouter from "./routes/stats.js";
import settingsRouter from "./routes/settings.js";
import insightsRouter from "./routes/insights.js";

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;
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
  const extraOrigins = process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim());
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
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/bugs", bugsRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/insights", insightsRouter);
app.use("/api/settings", settingsRouter);


app.use("/api/feedback/:formId", (req, res, next) => {
  req.params.formId;
  next();
});

// Connect to MongoDB immediately
if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI, { dbName: "bugpilot" })
    .then(() => console.log("Connected to MongoDB → database: bugpilot"))
    .catch((err) =>
      console.warn(
        "MongoDB connection failed. Starting server without database. " +
          err.message
      )
    );
} else {
  console.warn("MONGODB_URI not set. Starting server without database.");
}

// Only start the listener if not running in Vercel environment
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`BugPilot server running on http://localhost:${PORT}`);
  });
}

export default app;
