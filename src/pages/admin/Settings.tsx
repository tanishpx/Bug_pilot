import { useEffect, useState } from "react";
import { getSession, logout } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import {
  getSettings,
  updateSettings,
  type SettingsPayload,
} from "../../lib/api";

const ADMIN_EMAILS = [
  {
    email: "Tanish4181@gmail.com",
    role: "Primary Administrator",
    name: "Tanish",
  },
  {
    email: "sajalsinghal62650@gmail.com",
    role: "Administrator",
    name: "Sajal Singhal",
  },
];

export default function Settings() {
  const { dark, toggle } = useTheme();
  const sessionUser = getSession();
  const [copied, setCopied] = useState<string | null>(null);

  const [workspace, setWorkspace] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMcp, setSavingMcp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserEmail = sessionUser?.email || "Tanish4181@gmail.com";

  useEffect(() => {
    let active = true;

    getSettings()
      .then((data) => {
        if (active) setWorkspace(data);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load workspace settings.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleCopy = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSignOut = async () => {
    if (window.confirm("Are you sure you want to sign out of BugPilot?")) {
      await logout();
      window.location.href = "/#/auth";
    }
  };

  const mcp = workspace?.mcp ?? null;
  const mcpEnabled = workspace?.settings.mcpEnabled ?? true;
  const mcpConfig = mcp ? JSON.stringify(mcp.clientConfig, null, 2) : "";

  const handleToggleMcp = async () => {
    if (!workspace || savingMcp) return;

    setSavingMcp(true);
    setError(null);

    try {
      const updated = await updateSettings({ mcpEnabled: !mcpEnabled });
      setWorkspace(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update MCP access.");
    } finally {
      setSavingMcp(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="admin-head">
        <div>
          <h1>Settings</h1>
          <p>View your profile, administrator accounts, AI assistant access, theme preferences, and session controls.</p>
        </div>
      </div>

      <div className="simple-settings-container">
        {/* 1. Profile Email ID */}
        <div className="simple-settings-card">
          <div className="simple-card-header">
            <div className="simple-card-title">
              <i className="fa-solid fa-circle-user"></i>
              <h3>Your Profile</h3>
            </div>
            <span className="badge badge-priority">Active Session</span>
          </div>

          <div className="simple-profile-box">
            <div className="simple-avatar">
              {currentUserEmail.charAt(0).toUpperCase()}
            </div>
            <div className="simple-profile-details">
              <span className="simple-label">Logged In Email ID</span>
              <div className="simple-email-row">
                <strong className="simple-email-text">{currentUserEmail}</strong>
                <button
                  type="button"
                  className="simple-copy-btn"
                  onClick={() => handleCopy(currentUserEmail, "profile")}
                  title="Copy email address"
                >
                  {copied === "profile" ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <span className="simple-role-tag">
                <i className="fa-solid fa-shield-halved"></i> Administrator
              </span>
            </div>
          </div>
        </div>

        {/* 2. Administrator Emails */}
        <div className="simple-settings-card">
          <div className="simple-card-header">
            <div className="simple-card-title">
              <i className="fa-solid fa-users-gear"></i>
              <h3>Administrator Emails</h3>
            </div>
            <span className="badge badge-type">{ADMIN_EMAILS.length} Administrators</span>
          </div>

          <p className="simple-desc">
            Authorized administrator accounts with full permissions to manage forms, bugs, and system settings.
          </p>

          <div className="simple-admin-list">
            {ADMIN_EMAILS.map((admin) => (
              <div key={admin.email} className="simple-admin-item">
                <div className="simple-admin-avatar">
                  <i className="fa-solid fa-user-shield"></i>
                </div>
                <div className="simple-admin-info">
                  <div className="simple-admin-top">
                    <h4>{admin.name}</h4>
                    <span className="badge simple-role-badge">
                      {admin.role}
                    </span>
                  </div>
                  <div className="simple-email-row">
                    <code className="simple-code-email">{admin.email}</code>
                    <button
                      type="button"
                      className="simple-copy-btn"
                      onClick={() => handleCopy(admin.email, admin.email)}
                      title="Copy administrator email"
                    >
                      {copied === admin.email ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. AI Assistant / MCP Integration */}
        <div className="simple-settings-card">
          <div className="simple-card-header">
            <div className="simple-card-title">
              <i className="fa-solid fa-robot"></i>
              <h3>AI Assistant (MCP)</h3>
            </div>
            <div className="simple-mcp-head-actions">
              <span className={`simple-mcp-state ${mcpEnabled ? "on" : "off"}`}>
                <i className={`fa-solid ${mcpEnabled ? "fa-circle-check" : "fa-circle-pause"}`}></i>
                {mcpEnabled ? "Enabled" : "Disabled"}
              </span>
              <button
                type="button"
                className={`simple-switch ${mcpEnabled ? "on" : ""}`}
                onClick={handleToggleMcp}
                disabled={!workspace || savingMcp}
                aria-pressed={mcpEnabled}
                aria-label="Toggle MCP access"
                title={workspace ? "Toggle MCP access" : "Settings are unavailable"}
              >
                <span className="simple-switch-knob" />
              </button>
            </div>
          </div>

          <p className="simple-desc">
            Connect Claude Desktop, Cursor, Windsurf, or another MCP client to Bug Pilot. The assistant
            can search bugs, read full diagnostics, file reports, record hypotheses, and update statuses.
          </p>

          {error && (
            <div className="simple-mcp-warning">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <p className="simple-desc">Checking MCP status…</p>
          ) : mcp ? (
            <>
              <div className="simple-mcp-grid">
                <div className="simple-mcp-stat">
                  <span className="simple-label">Server build</span>
                  <strong className={mcp.server.built ? "ok" : "warn"}>
                    {mcp.server.built ? "Ready" : "Not built"}
                  </strong>
                </div>
                <div className="simple-mcp-stat">
                  <span className="simple-label">Database</span>
                  <strong className={mcp.database === "connected" ? "ok" : "warn"}>
                    {mcp.database === "connected" ? "Connected" : "Disconnected"}
                  </strong>
                </div>
                <div className="simple-mcp-stat">
                  <span className="simple-label">Transport</span>
                  <strong>{mcp.transport}</strong>
                </div>
                <div className="simple-mcp-stat">
                  <span className="simple-label">Data source</span>
                  <strong>{mcp.dataSourceMode}</strong>
                </div>
              </div>

              {!mcp.server.built && (
                <div className="simple-mcp-warning">
                  <i className="fa-solid fa-hammer"></i>
                  <span>
                    Build the server before connecting: <code>npm --prefix mcp-server run build</code>
                  </span>
                </div>
              )}

              <div className="simple-mcp-section">
                <span className="simple-label">Available tools</span>
                <div className="simple-mcp-tools">
                  {mcp.capabilities.tools.map((tool) => (
                    <span
                      key={tool.name}
                      className={`simple-mcp-tool ${tool.writes ? "write" : ""}`}
                      title={tool.description}
                    >
                      <i className={`fa-solid ${tool.writes ? "fa-pen" : "fa-eye"}`}></i>
                      {tool.name}
                    </span>
                  ))}
                </div>
                <p className="simple-mcp-hint">
                  <i className="fa-solid fa-eye"></i> read-only · <i className="fa-solid fa-pen"></i> writes data
                </p>
              </div>

              <div className="simple-mcp-section">
                <div className="simple-mcp-config-head">
                  <div>
                    <span className="simple-label">Client configuration</span>
                    <p className="simple-mcp-hint">
                      Paste this into your MCP client's server configuration.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="simple-copy-btn"
                    onClick={() => handleCopy(mcpConfig, "mcp-config")}
                  >
                    {copied === "mcp-config" ? "✓ Copied" : "Copy config"}
                  </button>
                </div>
                <pre className="simple-mcp-code">{mcpConfig}</pre>
              </div>

              <ol className="simple-mcp-steps">
                <li>Build the server: <code>npm --prefix mcp-server run build</code></li>
                <li>Copy the configuration above into your AI client.</li>
                <li>Restart the client so it discovers the Bug Pilot tools.</li>
              </ol>
            </>
          ) : (
            <p className="simple-desc">MCP status is unavailable. Start the API server and reload.</p>
          )}
        </div>

        {/* 4. Dark and Light Mode Switch */}
        <div className="simple-settings-card">
          <div className="simple-card-header">
            <div className="simple-card-title">
              <i className="fa-solid fa-circle-half-stroke"></i>
              <h3>Theme Preferences</h3>
            </div>
            <span className="badge badge-type">
              <i className={`fa-solid ${dark ? "fa-moon" : "fa-sun"}`} aria-hidden="true" />
              {dark ? "Dark mode" : "Light mode"}
            </span>
          </div>

          <p className="simple-desc">
            Toggle between light and dark appearance for your workspace.
          </p>

          <div className="simple-theme-toggle-row">
            <button
              type="button"
              className={`simple-theme-btn ${!dark ? "active" : ""}`}
              onClick={() => {
                if (dark) toggle();
              }}
            >
              <div className="simple-theme-btn-icon light">
                <i className="fa-solid fa-sun"></i>
              </div>
              <div className="simple-theme-btn-text">
                <strong>Light Mode</strong>
                <small>Clean, high-contrast daytime interface</small>
              </div>
              {!dark && (
                <i className="fa-solid fa-circle-check simple-check-icon"></i>
              )}
            </button>

            <button
              type="button"
              className={`simple-theme-btn ${dark ? "active" : ""}`}
              onClick={() => {
                if (!dark) toggle();
              }}
            >
              <div className="simple-theme-btn-icon dark">
                <i className="fa-solid fa-moon"></i>
              </div>
              <div className="simple-theme-btn-text">
                <strong>Dark Mode</strong>
                <small>Sleek dark look, comfortable for low light</small>
              </div>
              {dark && (
                <i className="fa-solid fa-circle-check simple-check-icon"></i>
              )}
            </button>
          </div>
        </div>

        {/* 5. Sign Out Option */}
        <div className="simple-settings-card simple-danger-card">
          <div className="simple-card-header">
            <div className="simple-card-title simple-danger-title">
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
              <h3>Account Session</h3>
            </div>
          </div>

          <div className="simple-signout-row">
            <div className="simple-signout-copy">
              <strong>Sign out of your account</strong>
              <span>Disconnect this browser from the console.</span>
            </div>

            <button
              type="button"
              className="simple-signout-btn"
              onClick={handleSignOut}
            >
              <i className="fa-solid fa-right-from-bracket"></i> Sign Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
