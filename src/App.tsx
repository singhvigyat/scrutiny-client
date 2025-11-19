// src/App.tsx
import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from "react-router-dom";

// Auth context + provider
import { AuthProvider, useAuthContext } from "./auth/AuthProvider";

// Use the standalone SignIn / SignUp components (not AuthPage)
import SignIn from "./auth/SignIn";
import SignUp from "./auth/SignUp";

// Dashboards
import StudentDashboard from "./components/StudentDashboard";
import TeacherDashboard from "./components/TeacherDashboard";

type View = "sign-in" | "sign-up";

/**
 * ProtectedRoute uses the role from AuthContext (not Supabase user metadata).
 * It also respects roleLoading to avoid racing.
 */
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactElement; allowedRoles?: string[] }) {
  const { user, role, roleLoading } = useAuthContext();
  const location = useLocation();

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Checking permissions...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!role || !allowedRoles.includes(role)) {
      // logged in but wrong role — redirect to appropriate dashboard if role present
      if (role === "student") return <Navigate to="/student" replace />;
      if (role === "teacher") return <Navigate to="/teacher" replace />;
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

// Simple protected dashboard shown when user is present
function SmallDashboard() {
  const { user, setRole } = useAuthContext();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="bg-white shadow-md rounded-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-semibold text-slate-700">
          Welcome, {user?.user_metadata?.full_name || user?.email}
        </h1>

        <p className="mt-3 text-slate-600 text-sm">You are logged in. This is your secure dashboard.</p>

        <div className="mt-6 flex gap-2">
          <button
            onClick={async () => {
              const { supabase } = await import("./lib/supabaseClient");
              await supabase.auth.signOut();
              setRole(null); // clear persisted role & context
              // navigate to home explicitly to ensure UI updates
              // navigate("/");
            }}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md"
          >
            Sign out
          </button>

          {/* quick navigation to role dashboards (if role present in localStorage) */}
          <Link to="/student" className="px-4 py-2 bg-sky-600 text-white rounded-md">
            Go to Student
          </Link>
          <Link to="/teacher" className="px-4 py-2 bg-indigo-600 text-white rounded-md">
            Go to Teacher
          </Link>
        </div>
      </div>
    </div>
  );
}

// Root component that chooses between auth UI and dashboard (keeps original inline UI)
function AppRoot() {
  const { user, roleLoading } = useAuthContext();
  const [view, setView] = useState<View>("sign-in");

  // Wait for roleLoading to finish to avoid flicker/race
  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  // if logged in, show small dashboard (role is already set in context by SignIn)
  if (user) return <SmallDashboard />;

  // not logged in -> show either SignIn or SignUp
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        {/* Left panel (info + toggles) */}
        <div className="p-8 md:p-10 bg-gradient-to-b from-sky-600 to-indigo-600 text-white flex flex-col justify-center">
          <h1 className="text-3xl font-semibold">Welcome to Scrutiny</h1>
          <p className="mt-4 text-sky-100">Secure sign-in for teachers and students.</p>

          <div className="mt-8 space-x-2">
            <button
              onClick={() => setView("sign-in")}
              className={`px-4 py-2 rounded-md text-sm font-medium ${view === "sign-in" ? "bg-white/90 text-sky-700" : "bg-white/10 text-white/90"}`}
            >
              Sign in
            </button>
            <button
              onClick={() => setView("sign-up")}
              className={`px-4 py-2 rounded-md text-sm font-medium ${view === "sign-up" ? "bg-white/90 text-sky-700" : "bg-white/10 text-white/90"}`}
            >
              Create account
            </button>
          </div>

          <div className="mt-6 text-sm text-sky-100">
            <p>
              <strong>Tip:</strong> Students enter MIS, teachers enter Employee ID during sign-up.
            </p>
          </div>

          <div className="mt-auto text-xs text-white/60">
            <p>Built with ♥ · Electron + Vite + React</p>
          </div>
        </div>

        {/* Right panel (forms) */}
        <div className="p-8 md:p-10">
          {view === "sign-in" ? (
            <>
              <SignIn />
              <div className="mt-4 text-sm text-slate-500">
                Don't have an account?{" "}
                <button className="text-sky-600" onClick={() => setView("sign-up")}>
                  Create account
                </button>
              </div>
            </>
          ) : (
            <>
              <SignUp onAfterSignUp={() => setView("sign-in")} />
              <div className="mt-4 text-sm text-slate-500">
                Already have an account?{" "}
                <button className="text-sky-600" onClick={() => setView("sign-in")}>
                  Sign in
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Main App with router + routes
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* home — the inline auth + small dashboard (if logged in) */}
          <Route path="/" element={<AppRoot />} />

          {/* dedicated auth pages */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp onAfterSignUp={() => { /* no-op here */ }} />} />

          {/* student dashboard (protected, only students allowed) */}
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          {/* teacher dashboard (protected, only teachers allowed) */}
          <Route
            path="/teacher"
            element={
              <ProtectedRoute allowedRoles={["teacher"]}>
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />

          {/* small authenticated dashboard accessible to any logged in user (example) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <SmallDashboard />
              </ProtectedRoute>
            }
          />

          {/* fallback: redirect unknown routes to / */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
