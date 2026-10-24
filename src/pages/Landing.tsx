import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BrandMark from "../components/BrandMark";

const keyFeatures = [
  {
    icon: "fa-bolt",
    title: "Fast Incident Triage",
    desc: "Track issues by severity, priority, and status. Keep stack traces, logs, and repro checklists together in one record.",
  },
  {
    icon: "fa-share-nodes",
    title: "Public Feedback Forms",
    desc: "Generate instant shareable links for users and testers to report bugs with auto-detected browser and environment details.",
  },
  {
    icon: "fa-robot",
    title: "AI & MCP Native",
    desc: "Connect Cursor, Claude Desktop, or autonomous coding agents via Model Context Protocol to investigate and resolve tickets.",
  },
];

export default function Landing() {
  return (
    <div className="page landing-page">
      <Navbar />

      <main className="simple-landing">
        <section className="simple-hero">
          <div className="simple-hero-badge">
            <BrandMark className="simple-hero-logo" />
          </div>

          <h1 className="simple-hero-title">BugPilot</h1>

          <p className="simple-hero-tagline">
            Bug tracking and incident management, simplified.
          </p>

          <p className="simple-hero-desc">
            Capture bug reports, inspect reproduction steps, triage severity, and resolve issues from one shared console.
          </p>

          <div className="simple-hero-cta">
            <Link to="/auth?redirect=%2Fadmin%2Fbugs" className="btn primary lg">
              <i className="fa-solid fa-table-cells-large" aria-hidden="true" />
              Open Bug Console
            </Link>
            <Link to="/auth?mode=login" className="btn ghost lg">
              <i className="fa-solid fa-arrow-right-to-bracket" aria-hidden="true" />
              Sign In
            </Link>
          </div>
        </section>

        <section className="simple-features-section" aria-label="Core features">
          <div className="simple-features-grid">
            {keyFeatures.map((item) => (
              <div className="simple-feature-card" key={item.title}>
                <div className="simple-feature-icon">
                  <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
