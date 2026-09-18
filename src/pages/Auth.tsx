import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { auth, firebaseConfigured, login, loginWithGoogle, isAdmin, resetPassword, signup } from "../lib/auth";
import { onAuthStateChanged } from "firebase/auth";

type Mode = "login" | "signup";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const initialMode: Mode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const redirectTarget = searchParams.get("redirect") === "/admin" ? "/admin" : "/";

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (user) => {
      if (user && isAdmin(user)) navigate(redirectTarget, { replace: true });
    });
  }, [navigate, redirectTarget]);

  if (!firebaseConfigured) {
    return (
      <div className="auth-page">
        <div className="auth-panel">
          <Link to="/" className="auth-back">← Back to home</Link>
          <div className="auth-card">
            <h1>Firebase setup required</h1>
            <p className="auth-sub">Add the VITE_FIREBASE_* values from your Firebase project to .env, then restart the dev server.</p>
          </div>
        </div>
      </div>
    );
  }

  const switchMode = (m: Mode) => {
    setMode(m);
    setMessage("");
    navigate(`/auth?mode=${m}`, { replace: true });
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setMessage("Enter your email address first, then select Forgot password?.");
      return;
    }

    try {
      await resetPassword(email.trim());
      setMessage("If an account exists for this email, a password-reset link has been sent.");
    } catch {
      setMessage("We could not send the password-reset email. Please verify the email address and try again.");
    }
  };

  const finishLogin = (user: Awaited<ReturnType<typeof login>>["user"]) => {
    navigate(isAdmin(user) ? redirectTarget : "/", { replace: true });
  };

  const handleGoogleLogin = async () => {
    setMessage("");
    try {
      const result = await loginWithGoogle();
      finishLogin(result.user);
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
      if (code === "auth/operation-not-allowed") {
        setMessage("Google sign-in is not enabled for this Firebase project. Enable Google under Firebase Console > Authentication > Sign-in method.");
      } else if (code === "auth/unauthorized-domain") {
        setMessage("This website address is not authorized in Firebase. Add localhost under Firebase Console > Authentication > Settings > Authorized domains.");
      } else if (code === "auth/popup-blocked") {
        setMessage("Your browser blocked the Google sign-in window. Allow pop-ups for this website and try again.");
      } else if (code === "auth/popup-closed-by-user") {
        setMessage("Google sign-in was cancelled.");
      } else {
        setMessage("Google sign-in could not be completed. Please try again or use email and password.");
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      const result = mode === "signup"
        ? await signup(email, password)
        : await login(email, password);

      finishLogin(result.user);
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";

      if (code === "auth/email-already-in-use") {
        setMode("login");
        navigate("/auth?mode=login", { replace: true });
        setMessage("This email is already registered. Please use the Login tab to access your account.");
      } else if (code === "auth/invalid-credential") {
        setMessage("We could not sign you in with those details. Please check your email and password and try again.");
      } else {
        setMessage(error instanceof Error ? error.message : "We could not complete your request. Please try again.");
      }
    }
  };

  return (
    <div className="auth-page">
     
      

      <div className="auth-panel">
        <Link to="/" className="auth-back">← Back to home</Link>
        <div className="auth-card">
          <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="auth-sub">
            {mode === "login"
              ? "Log in to continue tracking your bugs."
              : "Start your free BugPilot workspace."}
          </p>

          <div className="seg">
            <button className={mode === "login" ? "seg-btn active" : "seg-btn"} onClick={() => switchMode("login")}>
              Login
            </button>
            <button className={mode === "signup" ? "seg-btn active" : "seg-btn"} onClick={() => switchMode("signup")}>
              Sign up
            </button>
          </div>

          {message && <p className="auth-message" role="alert">{message}</p>}

          <form className="auth-form" onSubmit={submit}>
            {mode === "signup" && (
              <label>
                <span>Full name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" required />
              </label>
            )}
            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
            </label>
            <label>
              <span>Password</span>
              <div className="pw">
                <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)}>
                  {showPw ? "🙈" : "👁️"}
                </button>
              </div>
            </label>
            {mode === "login" && (
              <div className="auth-row">
                <label className="check">
                  <input type="checkbox" defaultChecked /> Remember me
                </label>
                <button type="button" className="linkish" onClick={handlePasswordReset}>
                  Forgot password?
                </button>
              </div>
            )}

            <button className="btn primary lg block" type="submit">
              {mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <div className="auth-divider"><span>or continue with</span></div>
          <button className="btn google-btn lg block" type="button" onClick={handleGoogleLogin}>
            <span className="google-mark" aria-hidden>G</span>
            Continue with Google
          </button>

          <p className="auth-foot">
            {mode === "login" ? "No account yet? " : "Already have an account? "}
            <button className="linkish" onClick={() => switchMode(mode === "login" ? "signup" : "login")}>
              {mode === "login" ? "Sign up" : "Log in"}
            </button>
            <br />
            Sign in to access the BugPilot console and all features.
          </p>
        </div>
      </div>
    </div>
  );
}