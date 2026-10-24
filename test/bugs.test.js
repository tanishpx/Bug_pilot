import "dotenv/config";
import dns from "dns";
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {}
process.env.NODE_ENV = "test";
import test from "node:test";
import assert from "node:assert/strict";
import { connectDB, disconnectDB, isDbConnected } from "../server/config/db.js";
import app from "../server/index.js";
import Bug from "../server/models/Bug.js";
import InvestigationNote from "../server/models/InvestigationNote.js";
import Settings from "../server/models/Settings.js";
import { BugPilotApiDataSource } from "../mcp-server/dist/data/storage.js";

// Helper to make requests to the express app using in-process server listener
let baseUrl = "";
let serverInstance = null;

async function startTestServer() {
  await connectDB();
  return new Promise((resolve) => {
    serverInstance = app.listen(0, () => {
      const port = serverInstance.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
}

async function stopTestServer() {
  if (serverInstance) {
    await new Promise((resolve) => serverInstance.close(resolve));
  }
  await disconnectDB();
}

await startTestServer();

test("BugPilot Complete Database & MCP Test Suite", async (t) => {
  t.after(async () => {
    await stopTestServer();
    setTimeout(() => process.exit(0), 100);
  });

  // 1. Database Connection
  await t.test("1. Database connection is active and responsive", async () => {
    assert.equal(isDbConnected(), true, "MongoDB database should be connected");
  });

  let createdTestBugId = "";

  // 2. Create Bug
  await t.test("2. Create bug via POST /api/bugs saves to database", async () => {
    const payload = {
      title: "Automated Test Bug - Memory leak in image cache",
      description: "Memory consumption grows indefinitely when scrolling large galleries.",
      bugType: "Performance",
      severity: "High",
      priority: "P1",
      status: "New",
      stepsToReproduce: "1. Open gallery\n2. Scroll 500 images\n3. Observe RAM > 2GB",
      environment: "Chrome 128, Windows 11",
      reporterEmail: "tester@bugpilot.local",
      logs: "FATAL: JavaScript heap out of memory",
      tags: ["memory", "cache", "performance"],
    };

    const res = await fetch(`${baseUrl}/api/bugs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": "test-suite-user",
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201, "Should return 201 Created");
    const data = await res.json();
    assert.ok(data.id, "Bug should have an id/bugId");
    assert.equal(data.title, payload.title);
    assert.equal(data.severity, "High");
    assert.equal(data.bugType, "Performance");
    createdTestBugId = data.id;

    // Verify it actually persisted in MongoDB
    const persisted = await Bug.findOne({ bugId: createdTestBugId });
    assert.ok(persisted, "Bug must be found in MongoDB database");
    assert.equal(persisted.title, payload.title);
  });

  // 3. Get Bugs
  await t.test("3. Get bugs via GET /api/bugs returns database records", async () => {
    const res = await fetch(`${baseUrl}/api/bugs`, {
      headers: { "X-User-Id": "test-suite-user" },
    });

    assert.equal(res.status, 200);
    const bugs = await res.json();
    assert.ok(Array.isArray(bugs), "Should return array of bugs");
    assert.ok(bugs.length >= 1, "Should contain at least 1 bug");

    const found = bugs.find((b) => b.id === createdTestBugId || b.bugId === createdTestBugId);
    assert.ok(found, "Created bug must be present in GET /api/bugs response");
  });

  // 4. Get Single Bug
  await t.test("4. Get single bug via GET /api/bugs/:id retrieves details", async () => {
    const res = await fetch(`${baseUrl}/api/bugs/${createdTestBugId}`, {
      headers: { "X-User-Id": "test-suite-user" },
    });

    assert.equal(res.status, 200);
    const bug = await res.json();
    assert.equal(bug.id, createdTestBugId);
    assert.equal(bug.title, "Automated Test Bug - Memory leak in image cache");
    assert.ok(Array.isArray(bug.investigationNotes), "investigationNotes should be an array");
  });

  // 5. Update Bug
  await t.test("5. Update bug via PUT /api/bugs/:id updates database record", async () => {
    const updatePayload = {
      status: "In Progress",
      assignee: "Performance Team",
      severity: "Critical",
    };

    const res = await fetch(`${baseUrl}/api/bugs/${createdTestBugId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": "test-suite-user",
      },
      body: JSON.stringify(updatePayload),
    });

    assert.equal(res.status, 200);
    const updated = await res.json();
    assert.equal(updated.status, "In Progress");
    assert.equal(updated.assignee, "Performance Team");
    assert.equal(updated.severity, "Critical");

    // Verify in MongoDB
    const persisted = await Bug.findOne({ bugId: createdTestBugId });
    assert.equal(persisted.status, "In Progress");
    assert.equal(persisted.assignee, "Performance Team");
  });

  // 6. Investigation Notes
  await t.test("6. Add investigation note via POST /api/bugs/:id/notes persists in DB", async () => {
    const notePayload = {
      author: "Profiler Agent",
      hypothesis: "Image canvases are retained by event listeners",
      details: "Heap snapshot demonstrates detached HTMLCanvasElements retained in window.__cache",
      suggestedFix: "Implement WeakMap for thumbnail cache and attach AbortController to window scroll listeners",
    };

    const res = await fetch(`${baseUrl}/api/bugs/${createdTestBugId}/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": "test-suite-user",
      },
      body: JSON.stringify(notePayload),
    });

    assert.equal(res.status, 201);
    const note = await res.json();
    assert.ok(note.id || note.noteId, "Note should have an ID");
    assert.equal(note.hypothesis, notePayload.hypothesis);

    // Verify retrieval of single bug now includes the note
    const bugRes = await fetch(`${baseUrl}/api/bugs/${createdTestBugId}`, {
      headers: { "X-User-Id": "test-suite-user" },
    });
    const bugData = await bugRes.json();
    assert.ok(bugData.investigationNotes.length >= 1, "Bug should have at least 1 investigation note");
    const noteInBug = bugData.investigationNotes.find((n) => n.details === notePayload.details);
    assert.ok(noteInBug, "Note must be populated on the bug");
  });

  // 7. Search & Filter Bugs
  await t.test("7. Search and filter bugs via query parameters", async () => {
    const searchRes = await fetch(`${baseUrl}/api/bugs?search=Memory%20leak`, {
      headers: { "X-User-Id": "test-suite-user" },
    });
    assert.equal(searchRes.status, 200);
    const searchResults = await searchRes.json();
    assert.ok(searchResults.length >= 1);
    assert.ok(searchResults.some((b) => b.id === createdTestBugId));

    const statusRes = await fetch(`${baseUrl}/api/bugs?status=In%20Progress`, {
      headers: { "X-User-Id": "test-suite-user" },
    });
    assert.equal(statusRes.status, 200);
    const statusResults = await statusRes.json();
    assert.ok(statusResults.every((b) => b.status === "In Progress"));
  });

  // 8. Invalid Bug Data
  await t.test("8. Invalid bug data returns 400 validation error", async () => {
    const invalidPayload = {
      title: "", // Empty title
      severity: "UltraExtremeDangerous", // Invalid severity
    };

    const res = await fetch(`${baseUrl}/api/bugs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": "test-suite-user",
      },
      body: JSON.stringify(invalidPayload),
    });

    assert.equal(res.status, 400, "Should reject invalid payload with 400");
    const data = await res.json();
    assert.ok(data.error, "Should return descriptive validation error");
  });

  // 9. Unauthorized / Missing Bugs
  await t.test("9. Missing bug returns 404 Not Found", async () => {
    const res = await fetch(`${baseUrl}/api/bugs/BUG-NONEXISTENT-99999`, {
      headers: { "X-User-Id": "test-suite-user" },
    });
    assert.equal(res.status, 404, "Nonexistent bug should return 404");
  });

  // 10. Health check endpoint
  await t.test("10. Health check returns ok and database connection status", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "ok");
    assert.equal(data.database, "connected");
  });

  // 11. MCP API client search against the running API
  await t.test("11. MCP BugPilotApiDataSource searches real API bugs", async () => {
    const dataSource = new BugPilotApiDataSource(`${baseUrl}/api`);
    const results = await dataSource.getAll({ status: "In Progress" });

    assert.ok(Array.isArray(results));
    assert.ok(results.length >= 1, "Should find In Progress bugs via the API");
    assert.ok(
      results.some((b) => b.id === createdTestBugId),
      "The fixture bug must be found by the status filter"
    );
    assert.ok(
      results.every((b) => b.status === "In Progress"),
      "The MCP data source must honor the status filter"
    );
  });

  // 12. MCP API client retrieval against the running API
  await t.test("12. MCP BugPilotApiDataSource retrieves a bug and its investigation notes", async () => {
    const dataSource = new BugPilotApiDataSource(`${baseUrl}/api`);
    const bug = await dataSource.getById(createdTestBugId);

    assert.ok(bug, "The test fixture bug must be retrievable through the MCP data source");
    assert.equal(bug.id, createdTestBugId);
    assert.ok(bug.description.includes("Memory consumption grows"));
    assert.ok(Array.isArray(bug.investigationNotes));
    assert.ok(bug.investigationNotes.length >= 1, "The fixture bug should have an investigation note");
  });

  // 13. Delete Bug cleanup
  await t.test("13. Delete bug via DELETE /api/bugs/:id removes from database", async () => {
    const res = await fetch(`${baseUrl}/api/bugs/${createdTestBugId}`, {
      method: "DELETE",
      headers: { "X-User-Id": "test-suite-user" },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.bugId, createdTestBugId);

    // Verify deletion in database
    const inDb = await Bug.findOne({ bugId: createdTestBugId });
    assert.equal(inDb, null, "Bug should be deleted from database");

    const notesInDb = await InvestigationNote.find({ bugId: createdTestBugId });
    assert.equal(notesInDb.length, 0, "Investigation notes should be deleted with bug");
  });

  // 14. Settings seam: one load/save interface includes MCP status
  await t.test("14. Settings returns workspace settings and MCP status through one interface", async () => {
    const userId = "settings-seam-user";
    const res = await fetch(`${baseUrl}/api/settings`, {
      headers: { "X-User-Id": userId },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.settings.mcpEnabled, true);
    assert.equal(data.mcp.enabled, true);
    assert.equal(data.mcp.dataSourceMode, "bugpilot_api");
    assert.equal(
      data.mcp.clientConfig.mcpServers["bug-pilot"].env.DATA_SOURCE_MODE,
      undefined,
      "MCP client config must not expose a data-source mode"
    );
    assert.ok(data.mcp.capabilities.tools.length > 0, "MCP tools should come from the shared manifest");
  });

  // 15. Settings seam: the MCP toggle is enforced at the API seam
  await t.test("15. Settings MCP toggle is enforced for MCP-originated requests", async () => {
    const userId = "settings-seam-user";

    try {
      const disabled = await fetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        body: JSON.stringify({ mcpEnabled: false }),
      });
      assert.equal(disabled.status, 200);
      const disabledData = await disabled.json();
      assert.equal(disabledData.settings.mcpEnabled, false);
      assert.equal(disabledData.mcp.enabled, false);
      assert.equal(
        disabledData.settings.applicationName,
        "BugPilot",
        "Partial updates must still create a document with defaults"
      );

      const blocked = await fetch(`${baseUrl}/api/bugs?limit=1`, {
        headers: { "X-MCP-Agent": "bug-pilot-mcp", "X-User-Id": userId },
      });
      assert.equal(blocked.status, 403, "Disabled MCP access must be rejected at the API seam");

      const enabled = await fetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        body: JSON.stringify({ mcpEnabled: true }),
      });
      assert.equal(enabled.status, 200);

      const allowed = await fetch(`${baseUrl}/api/bugs?limit=1`, {
        headers: { "X-MCP-Agent": "bug-pilot-mcp", "X-User-Id": userId },
      });
      assert.equal(allowed.status, 200, "Re-enabled MCP access should be allowed");
    } finally {
      await Settings.deleteOne({ userId });
    }
  });
});
