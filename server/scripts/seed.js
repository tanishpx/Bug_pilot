import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB, disconnectDB } from "../config/db.js";
import Bug from "../models/Bug.js";
import InvestigationNote from "../models/InvestigationNote.js";
import User from "../models/User.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FALLBACK_SAMPLE_BUGS = [
  {
    id: "BUG-101",
    title: "Uncaught TypeError when submitting feedback form without email",
    description:
      "When a guest user submits a bug report without filling in the optional reporter email, the client throws a TypeError reading property 'trim' of undefined and the form gets stuck in loading state.",
    type: "UI",
    severity: "High",
    status: "New",
    stepsToReproduce:
      "1. Open the public bug submission form at /submit/form-123\n2. Fill in bug title and description\n3. Leave the reporter email empty\n4. Click 'Submit Report'\n5. Notice the submit button shows spinner indefinitely and console displays error",
    environment:
      "OS: macOS Sonoma 14.5, Browser: Chrome 126.0.6478.127, Viewport: 1920x1080",
    reporterEmail: "qa-tester@example.com",
    attachments: [
      "https://storage.example.com/screenshots/stuck-spinner.png",
    ],
    logs: "TypeError: Cannot read properties of undefined (reading 'trim')\n    at validateForm (src/components/FormSubmit.tsx:42:25)\n    at handleSubmit (src/components/FormSubmit.tsx:78:12)\n    at HTMLButtonElement.dispatch (node_modules/react-dom/cjs/react-dom.production.min.js:14:105)",
    relatedFiles: [
      "src/components/FormSubmit.tsx",
      "src/utils/validators.ts",
    ],
    investigationNotes: [
      {
        id: "NOTE-1",
        author: "triage-bot",
        hypothesis:
          "Email field might be initialized as undefined instead of empty string in form state.",
        details:
          "Validator expects a string and invokes .trim() directly without checking for null/undefined.",
        suggestedFix:
          "Use optional chaining (email?.trim()) or default to empty string.",
        timestamp: "2026-10-10T14:22:00.000Z",
      },
    ],
    createdAt: "2026-10-10T14:20:00.000Z",
    updatedAt: "2026-10-10T14:22:00.000Z",
  },
  {
    id: "BUG-102",
    title: "Auth token expiration causes 500 error instead of 401 redirect",
    description:
      "When the JWT expires during an active session, API requests to /api/bugs return 500 Internal Server Error due to unhandled TokenExpiredError instead of 401 Unauthorized.",
    type: "Backend",
    severity: "Critical",
    status: "In Progress",
    stepsToReproduce:
      "1. Log in to admin dashboard\n2. Wait for JWT token to expire or alter token expiration in local storage\n3. Refresh bug list or navigate to /admin/bugs\n4. Dashboard displays generic server error modal instead of redirecting to /auth",
    environment: "Node.js: 20.x, Express: 4.19.2, Environment: Staging",
    reporterEmail: "developer@example.com",
    attachments: [],
    logs: "TokenExpiredError: jwt expired\n    at /server/middleware/auth.js:28:19\n    at JsonWebTokenError.verify (/server/node_modules/jsonwebtoken/index.js:120:7)",
    relatedFiles: [
      "server/middleware/auth.js",
      "server/controllers/submissionController.js",
    ],
    investigationNotes: [],
    createdAt: "2026-10-11T09:15:00.000Z",
    updatedAt: "2026-10-11T09:15:00.000Z",
  },
  {
    id: "BUG-103",
    title: "Analytics aggregation slow query when submissions exceed 10,000",
    description:
      "GET /api/insights takes over 4.5 seconds to return because status/severity counts perform a full table scan without compound index on (userId, createdAt).",
    type: "Database",
    severity: "Medium",
    status: "New",
    stepsToReproduce:
      "1. Populate test database with 15k submissions\n2. Open /admin/analytics\n3. Measure network response time for GET /api/insights",
    environment: "MongoDB Atlas M10 cluster, Mongoose 8.x",
    reporterEmail: "backend-team@example.com",
    attachments: [],
    logs: "PlanSummary: COLLSCAN\nmillis: 4520\nnumYields: 38",
    relatedFiles: [
      "server/models/Submission.js",
      "server/controllers/insightsController.js",
    ],
    investigationNotes: [],
    createdAt: "2026-10-11T12:00:00.000Z",
    updatedAt: "2026-10-11T12:00:00.000Z",
  },
];

export async function seedDatabase() {
  console.log("=== Seeding Bug_Pilot Database ===");
  await connectDB();

  // 1. Seed Users
  console.log("→ Seeding default development users...");
  const usersToSeed = [
    {
      userId: "dev-user",
      name: "Development Engineer",
      email: "developer@bugpilot.local",
      role: "developer",
    },
    {
      userId: "admin-user",
      name: "BugPilot Admin",
      email: "admin@example.com",
      role: "admin",
    },
    {
      userId: "qa-user",
      name: "QA Lead",
      email: "qa-tester@example.com",
      role: "tester",
    },
  ];

  for (const user of usersToSeed) {
    await User.findOneAndUpdate(
      { email: user.email },
      { $setOnInsert: user },
      { upsert: true, new: true }
    );
  }
  console.log(`✓ Seeded ${usersToSeed.length} users.`);

  // 2. Load bug data from sample-bugs.json if present, or fallback
  let sampleBugs = FALLBACK_SAMPLE_BUGS;
  const sampleBugsPath = path.resolve(__dirname, "../../mcp-server/src/data/sample-bugs.json");

  if (fs.existsSync(sampleBugsPath)) {
    try {
      const raw = fs.readFileSync(sampleBugsPath, "utf-8");
      sampleBugs = JSON.parse(raw);
      console.log(`→ Read ${sampleBugs.length} bugs from input file: ${sampleBugsPath}`);
    } catch {
      console.log("→ Using internal fallback sample bugs dataset.");
    }
  }

  // 3. Upsert Bugs and Investigation Notes
  console.log("→ Upserting sample bugs into database...");
  let bugCount = 0;
  let noteCount = 0;

  for (const item of sampleBugs) {
    const bugId = item.id || `BUG-${Date.now()}`;
    const bugDoc = await Bug.findOneAndUpdate(
      { bugId },
      {
        $set: {
          bugId,
          formId: bugId,
          title: item.title,
          description: item.description,
          bugType: item.type || "UI",
          severity: item.severity || "Medium",
          priority: item.priority || "P2",
          status: item.status || "New",
          stepsToReproduce: item.stepsToReproduce || "",
          environment: item.environment || "",
          reporterEmail: item.reporterEmail || "",
          reporter: item.reporterEmail || "QA Tester",
          assignee: item.assignee || "Unassigned",
          attachments: item.attachments || [],
          logs: item.logs || "",
          relatedFiles: item.relatedFiles || [],
          tags: item.tags || [],
          isPublic: true,
          userId: "dev-user",
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        },
      },
      { upsert: true, new: true }
    );
    bugCount++;

    if (Array.isArray(item.investigationNotes) && item.investigationNotes.length > 0) {
      for (const note of item.investigationNotes) {
        const noteId = note.id || `NOTE-${Date.now()}`;
        await InvestigationNote.findOneAndUpdate(
          { noteId, bugId },
          {
            $set: {
              noteId,
              bugId,
              bug: bugDoc._id,
              userId: "dev-user",
              author: note.author || "AI Agent",
              hypothesis: note.hypothesis || "",
              details: note.details,
              suggestedFix: note.suggestedFix || "",
              timestamp: note.timestamp ? new Date(note.timestamp) : new Date(),
            },
          },
          { upsert: true, new: true }
        );
        noteCount++;
      }
    }
  }

  console.log(`✓ Seeded/Upserted ${bugCount} bugs and ${noteCount} investigation notes into MongoDB.`);
  console.log("=== Seeding completed successfully ===");
}

// Allow direct execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seedDatabase()
    .then(() => disconnectDB())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding error:", err);
      process.exit(1);
    });
}

