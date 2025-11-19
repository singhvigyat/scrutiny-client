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
import { TeacherDashboard } from "./components/TeacherDashboard";

// UI
import { Button } from "./components/ui/Button";
import { Card } from "./components/ui/Card";
import { ThemeToggle } from "./components/ThemeToggle";
import { LogOut, User, Shield } from "lucide-react";

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="text-slate-600 dark:text-slate-400">Checking permissions...</p>
        </div>
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-6 transition-colors duration-200">
      <Card className="max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Shield className="w-6 h-6" />
            <span className="font-bold text-lg">Scrutiny</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Welcome Back
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm">
            {user?.user_metadata?.full_name || user?.email}
          </p>
        </div>

        <div className="space-y-3">
          <Link to="/student" className="block">
            <Button className="w-full" variant="primary">Go to Student Dashboard</Button>
          </Link>
          <Link to="/teacher" className="block">
            <Button className="w-full" variant="secondary">Go to Teacher Dashboard</Button>
          </Link>
          
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700 mt-4">
            <Button
              variant="danger"
              className="w-full"
              icon={<LogOut className="w-4 h-4" />}
              onClick={async () => {
                const { supabase } = await import("./lib/supabaseClient");
                await supabase.auth.signOut();
                setRole(null);
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </Card>
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // if logged in, show small dashboard (role is already set in context by SignIn)
  if (user) return <SmallDashboard />;

  // not logged in -> show either SignIn or SignUp
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-6 transition-colors duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl grid grid-cols-1 md:grid-cols-2 overflow-hidden border border-slate-200 dark:border-slate-700">
        {/* Left panel (info + toggles) */}
        <div className="p-8 md:p-12 bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="w-8 h-8 text-indigo-200" />
              <span className="text-2xl font-bold">Scrutiny</span>
            </div>
            
            <h1 className="text-3xl font-bold mb-4">Secure Assessment Platform</h1>
            <p className="text-indigo-100 mb-8 leading-relaxed">
              The modern platform for teachers and students. Create quizzes, manage sessions, and track progress in real-time.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setView("sign-in")}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  view === "sign-in" 
                    ? "bg-white text-indigo-600 shadow-lg" 
                    : "bg-indigo-800/40 text-white hover:bg-indigo-800/60 backdrop-blur-sm"
                }`}
              >
                Sign in
              </button>
              <button
                onClick={() => setView("sign-up")}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  view === "sign-up" 
                    ? "bg-white text-indigo-600 shadow-lg" 
                    : "bg-indigo-800/40 text-white hover:bg-indigo-800/60 backdrop-blur-sm"
                }`}
              >
                Create account
              </button>
            </div>

            <div className="mt-12 pt-8 border-t border-indigo-500/30 text-xs text-indigo-200">
              <p>Built for secure and reliable testing environments.</p>
            </div>
          </div>
        </div>

        {/* Right panel (forms) */}
        <div className="p-8 md:p-12 flex flex-col justify-center relative bg-white dark:bg-slate-800">
          <div className="absolute top-6 right-6">
            <ThemeToggle />
          </div>
          
          {view === "sign-in" ? (
            <>
              <SignIn />
              <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Don't have an account?{" "}
                <button className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline" onClick={() => setView("sign-up")}>
                  Create account
                </button>
              </div>
            </>
          ) : (
            <>
              <SignUp onAfterSignUp={() => setView("sign-in")} />
              <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Already have an account?{" "}
                <button className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline" onClick={() => setView("sign-in")}>
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
