import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../lib/theme";
import { getSession, logout } from "../lib/auth";
import BrandMark from "./BrandMark";

export default function Navbar() {
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(getSession());

  useEffect(() => {
    setUser(getSession());
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    setUser(null);
    navigate("/");
  };

  return (
    <nav className="nav">
      <Link to="/" className="logo" onClick={() => window.scrollTo({ top: 0 })}>
        <BrandMark />
        <span>BugPilot</span>
      </Link>

      <div className="nav-actions">
        <button className="icon-btn" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
          {dark ? <i className="fa-solid fa-sun"></i> : <i className="fa-solid fa-moon"></i>}
        </button>

        {user ? (
          <>
            <span className="user-email">{user.email}</span>
            <Link to="/admin/bugs" className="btn ghost">
              Open console
            </Link>
            <button className="btn ghost" onClick={handleLogout}>
              Log out
            </button>
          </>
        ) : (
          <Link to="/auth?redirect=%2Fadmin%2Fbugs" className="btn primary">
            Open console
          </Link>
        )}
      </div>
    </nav>
  );
}

