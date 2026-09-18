import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import Auth from "./pages/Auth";
import AdminLayout from "./pages/admin/AdminLayout";
import FeedbackForms from "./pages/admin/FeedbackForms";
import BugDashboard from "./pages/admin/BugDashboard";
import Submissions from "./pages/admin/Submissions";
import Analytics from "./pages/admin/Analytics.tsx";
import Settings from "./pages/admin/Settings";
import FeedbackFormPage from "./pages/FeedbackFormPage";

import Landing from "./pages/Landing";
import { auth } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";

function ProtectedRoute() {
  const [user, setUser] = useState(auth?.currentUser || null);
  const [loading, setLoading] = useState(Boolean(auth));

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="gate">
        <p>Checking access...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth?redirect=%2Fadmin" replace />;
  }

  return <AdminLayout />;
}

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/feedback/:formId" element={<FeedbackFormPage />} />
        <Route path="/admin" element={<ProtectedRoute />}>
          <Route index element={<Navigate to="/admin/forms" replace />} />
          <Route path="forms" element={<FeedbackForms />} />
          <Route path="bugs" element={<BugDashboard />} />
          <Route path="submissions" element={<Submissions />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
