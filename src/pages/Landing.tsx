import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BrandMark from "../components/BrandMark";

export default function Landing() {
  const [activeTab, setActiveTab] = useState<"incident" | "mcp">("incident");
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({
    0: true,
    1: true,
    2: false,
  });

  const toggleStep = (index: number) => {
    setCheckedSteps((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="page landing-page">
      <Navbar />

      <main className="precision-landing">
        {/* Hero Section */}
        <section className="precision-hero">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="hero-badge-dot"></span>
              <span>Incident Response · Autonomous MCP Tools · Triage Engine</span>
            </div>

            <h1 className="hero-title">
              Precision incident triage for engineering teams.
            </h1>

            <p className="hero-description">
              Capture user environments automatically, inspect reproduction steps,
              and connect AI coding assistants directly into your defect workflow over
              the Model Context Protocol.
            </p>

            <div className="hero-actions">
              <Link to="/auth?redirect=%2Fadmin%2Fbugs" className="btn primary lg">
                <i className="fa-solid fa-table-cells-large" aria-hidden="true" />
                Launch Console
              </Link>
              <Link to="/auth?mode=login" className="btn ghost lg">
                <i className="fa-solid fa-arrow-right-to-bracket" aria-hidden="true" />
                Sign In to Workspace
              </Link>
            </div>
          </div>

          {/* Hero Interactive Terminal & Telemetry Canvas */}
          <div className="hero-showcase">
            <div className="showcase-frame">
              <div className="showcase-header">
                <div className="showcase-tabs">
                  <button
                    type="button"
                    className={`showcase-tab ${activeTab === "incident" ? "active" : ""}`}
                    onClick={() => setActiveTab("incident")}
                  >
                    <i className="fa-solid fa-bug"></i>
                    <span>BUG-248 Telemetry</span>
                  </button>
                  <button
                    type="button"
                    className={`showcase-tab ${activeTab === "mcp" ? "active" : ""}`}
                    onClick={() => setActiveTab("mcp")}
                  >
                    <i className="fa-solid fa-robot"></i>
                    <span>AI Assistant (MCP)</span>
                  </button>
                </div>
                <div className="showcase-status">
                  <span className="status-indicator"></span>
                  <span>Active Session</span>
                </div>
              </div>

              {activeTab === "incident" ? (
                <div className="showcase-body">
                  <div className="incident-meta-bar">
                    <span className="incident-id">BUG-248</span>
                    <span className="badge sev-high">High Severity</span>
                    <span className="badge badge-p1">P1 Priority</span>
                    <span className="badge badge-type">UI & Auth</span>
                    <span className="badge status-in-progress">In Progress</span>
                  </div>

                  <h3 className="incident-title">
                    Session invalidated when tab awakes from background sleep
                  </h3>

                  <div className="incident-env-pill">
                    <i className="fa-solid fa-desktop"></i>
                    <span>Chrome 132.0.6834 / macOS 15.2 (1920×1080)</span>
                  </div>

                  <div className="incident-section">
                    <span className="section-label">Reproduction Checklist</span>
                    <ul className="repro-list">
                      <li
                        className={`repro-item ${checkedSteps[0] ? "checked" : ""}`}
                        onClick={() => toggleStep(0)}
                      >
                        <i className={`fa-regular ${checkedSteps[0] ? "fa-circle-check" : "fa-circle"}`}></i>
                        <span>Authenticate with valid engineer token and open console view</span>
                      </li>
                      <li
                        className={`repro-item ${checkedSteps[1] ? "checked" : ""}`}
                        onClick={() => toggleStep(1)}
                      >
                        <i className={`fa-regular ${checkedSteps[1] ? "fa-circle-check" : "fa-circle"}`}></i>
                        <span>Switch browser to background tab for &gt; 15 minutes</span>
                      </li>
                      <li
                        className={`repro-item ${checkedSteps[2] ? "checked" : ""}`}
                        onClick={() => toggleStep(2)}
                      >
                        <i className={`fa-regular ${checkedSteps[2] ? "fa-circle-check" : "fa-circle"}`}></i>
                        <span>Restore tab focus: notice silent 401 token refresh race condition</span>
                      </li>
                    </ul>
                  </div>

                  <div className="incident-note-card">
                    <div className="note-card-head">
                      <i className="fa-solid fa-robot note-ai-icon"></i>
                      <strong>Claude Sonnet 3.7 (MCP Client)</strong>
                      <span className="note-timestamp">Just now</span>
                    </div>
                    <p className="note-hypothesis">
                      <strong>Hypothesis:</strong> The token refresher in <code>lib/auth.ts</code> lacks a mutex lock during sleep recovery, issuing duplicate handshake frames.
                    </p>
                    <div className="note-fix">
                      <i className="fa-solid fa-wrench"></i>
                      <span><strong>Suggested fix:</strong> Wrap token refresh inside atomic promise deduplicator before dispatch.</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="showcase-body mcp-terminal">
                  <div className="terminal-header">
                    <span className="term-dot red"></span>
                    <span className="term-dot yellow"></span>
                    <span className="term-dot green"></span>
                    <span className="term-title">mcp-server: stdio</span>
                  </div>
                  <pre className="terminal-code">
{`$ npx @modelcontextprotocol/inspector --server bug-pilot
[INFO] Transport connected over stdio
[INFO] Schema validated: 5 tools discovered

> query: get_bug_context({ bugId: "BUG-248" })
< response: {
    "status": "In Progress",
    "severity": "High",
    "environment": "Chrome 132 / macOS 15.2",
    "reproSteps": "1. Background tab > 15m; 2. Wake window",
    "notesCount": 1
  }

> execute: add_investigation_note({
    "bugId": "BUG-248",
    "hypothesis": "Mutex lock required in auth token refresh",
    "suggestedFix": "Commit fix to lib/auth.ts"
  })
< [SUCCESS] Note attached. Bug status updated to Triaged.`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Live Metrics Ribbon */}
        <section className="metrics-ribbon" aria-label="System capabilities">
          <div className="metric-pill">
            <span className="metric-num">0ms</span>
            <span className="metric-label">Configuration to start logging</span>
          </div>
          <div className="metric-divider" aria-hidden="true"></div>
          <div className="metric-pill">
            <span className="metric-num">100%</span>
            <span className="metric-label">MCP 1.0 Spec Compliant</span>
          </div>
          <div className="metric-divider" aria-hidden="true"></div>
          <div className="metric-pill">
            <span className="metric-num">Auto</span>
            <span className="metric-label">Client environment metadata capture</span>
          </div>
          <div className="metric-divider" aria-hidden="true"></div>
          <div className="metric-pill">
            <span className="metric-num">Realtime</span>
            <span className="metric-label">Bi-directional team sync</span>
          </div>
        </section>

        {/* Core Capabilities */}
        <section className="features-grid-section" aria-label="Features">
          <div className="section-header-centered">
            <span className="section-eyebrow">Engineered for Reliability</span>
            <h2>Everything needed to diagnose and resolve software defects.</h2>
            <p>Built for developers, QA testers, and AI coding agents working collaboratively.</p>
          </div>

          <div className="features-grid-cards">
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <i className="fa-solid fa-list-check" />
              </div>
              <h3>Incident Triage & Matrix</h3>
              <p>
                Filter and sort defects by severity, priority, component, and assignee.
                Keep reproduction checklists and status transitions organized in one unified console.
              </p>
              <div className="feature-subtext">
                <i className="fa-solid fa-check"></i> Multi-status workflow (New → Triaged → Fixed)
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <i className="fa-solid fa-compass-drafting" />
              </div>
              <h3>Automated Client Environment</h3>
              <p>
                Share instant public feedback links with users or QA testers. BugPilot automatically
                detects browser engine, operating system, and screen resolution to eliminate repro guesswork.
              </p>
              <div className="feature-subtext">
                <i className="fa-solid fa-check"></i> Single-click auto-detection & file attachments
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <i className="fa-solid fa-microchip" />
              </div>
              <h3>Model Context Protocol Native</h3>
              <p>
                First-class MCP integration. AI assistants in Cursor, Claude Desktop, and CLI tools
                can query full defect diagnostics, add hypotheses, and update statuses without manual copy-pasting.
              </p>
              <div className="feature-subtext">
                <i className="fa-solid fa-check"></i> Standardized stdio client configuration ready to paste
              </div>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="bottom-cta-banner">
          <div className="cta-banner-content">
            <BrandMark className="cta-logo" />
            <h2>Accelerate defect resolution across your entire stack.</h2>
            <p>Deploy BugPilot into your engineering pipeline and empower both human teams and AI agents.</p>
            <div className="cta-buttons">
              <Link to="/auth?redirect=%2Fadmin%2Fbugs" className="btn primary lg">
                Open Bug Console
              </Link>
              <Link to="/auth?mode=signup" className="btn ghost lg">
                Create Team Account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
