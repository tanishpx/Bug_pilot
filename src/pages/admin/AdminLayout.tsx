import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { useTheme } from "../../lib/theme";
import { getSession, logout } from "../../lib/auth";
import { useState, useEffect } from "react";
import BrandMark from "../../components/BrandMark";

interface NavGroup {
  label: string;
  items: {
    to: string;
    icon: string;
    label: string;
    badge?: string;
  }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Triage",
    items: [
      { to: "/admin/bugs", icon: "fa-table-cells-large", label: "Bugs" },
      { to: "/admin/submissions", icon: "fa-inbox", label: "Submissions" },
    ],
  },
  {
    label: "Manage",
    items: [
      { to: "/admin/forms", icon: "fa-file-lines", label: "Forms" },
      { to: "/admin/analytics", icon: "fa-chart-line", label: "Analytics" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/settings", icon: "fa-sliders", label: "Settings" },
    ],
  },
];

export default function AdminLayout() {
  const { dark, toggle } = useTheme();
  const location = useLocation();
  const [user] = useState(getSession());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const initial = user?.email?.charAt(0).toUpperCase() || "B";

  // Close mobile navigation drawer when location changes
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  const getPageTitle = (path: string) => {
    if (path.includes("/admin/bugs")) return "Bugs";
    if (path.includes("/admin/submissions")) return "Submissions";
    if (path.includes("/admin/forms")) return "Forms";
    if (path.includes("/admin/analytics")) return "Analytics";
    if (path.includes("/admin/settings")) return "Settings";
    return "Console";
  };

  const currentTitle = getPageTitle(location.pathname);

  return (
    <div className="admin">
      <header className="admin-bar">
        <div className="admin-bar-left">
          <button
            type="button"
            className="admin-mobile-toggle icon-btn"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileNavOpen}
          >
            <i className={`fa-solid ${mobileNavOpen ? "fa-xmark" : "fa-bars"}`} />
          </button>

          <Link to="/" className="logo">
            <BrandMark />
            <span>BugPilot</span>
          </Link>
          <span className="admin-crumb-sep">/</span>
          <span className="admin-crumb-current">{currentTitle}</span>
        </div>

        <div className="admin-bar-right">
          <span className="admin-status-pill" title="Database status: Connected">
            <span className="status-dot"></span>
            <span className="admin-status-text">MongoDB Connected</span>
          </span>

          <button
            className="icon-btn"
            onClick={toggle}
            title={dark ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle theme"
          >
            {dark ? <i className="fa-solid fa-sun" /> : <i className="fa-solid fa-moon" />}
          </button>

          <Link to="/admin/bugs" className="btn primary sm admin-issues-btn" title="Go to main bug dashboard">
            <i className="fa-solid fa-bug" /> <span className="btn-label">Issues</span>
          </Link>

          <button className="icon-btn" onClick={handleLogout} title="Sign out" aria-label="Sign out">
            <i className="fa-solid fa-right-from-bracket" />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileNavOpen && (
        <div
          className="admin-drawer-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="admin-body">
        <aside className={`admin-side ${mobileNavOpen ? "open" : ""}`}>
          <div className="admin-workspace-card">
            <BrandMark className="admin-ws-mark" />
            <div className="admin-ws-info">
              <span className="admin-ws-name">BugPilot</span>
              <span className="admin-ws-role">Console</span>
            </div>
          </div>

          <nav className="admin-nav" aria-label="Console navigation">
            {navGroups.map((group) => (
              <div className="admin-nav-group" key={group.label}>
                <span className="admin-nav-heading">{group.label}</span>
                <div className="admin-nav-list">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileNavOpen(false)}
                      className={({ isActive }) => `admin-tab ${isActive ? "on" : ""}`}
                    >
                      <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="admin-side-foot">
            <div className="admin-user-pill">
              <span className="avatar" aria-hidden="true">{initial}</span>
              <div className="admin-user-info">
                <span className="admin-user-email">{user?.email || "admin@bugpilot.dev"}</span>
                <span className="admin-user-status">Administrator</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
