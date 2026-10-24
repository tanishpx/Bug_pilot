import { Link } from "react-router-dom";
import BrandMark from "./BrandMark";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <Link to="/" className="footer-brand">
            <BrandMark />
            <span>BugPilot</span>
          </Link>
          <p className="footer-tagline">
            Simple, fast bug tracking and incident management for software teams.
          </p>
        </div>

        <ul className="footer-links">
          <li>
            <Link to="/auth?redirect=%2Fadmin%2Fbugs">Console</Link>
          </li>
          <li>
            <Link to="/auth?mode=login">Sign in</Link>
          </li>
          <li>
            <Link to="/auth?mode=signup">Create account</Link>
          </li>
        </ul>
      </div>

      <p className="footer-copy">
        <span>© {new Date().getFullYear()} BugPilot</span>
        <span>Built for teams that ship with clarity.</span>
      </p>
    </footer>
  );
}

