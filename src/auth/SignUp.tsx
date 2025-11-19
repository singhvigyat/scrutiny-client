// src/auth/SignUp.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AlertCircle, UserPlus } from 'lucide-react';

type Role = 'student' | 'teacher';

interface SignUpProps {
  onAfterSignUp?: () => void;
}

export default function SignUp({ onAfterSignUp }: SignUpProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [mis, setMis] = useState('');
  const [employee_id, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const navigate = useNavigate();

  const BACKEND_URL =
    (import.meta.env.VITE_BACKEND_URL as string) || '';

  const apiBase = BACKEND_URL ? BACKEND_URL.replace(/\/$/, '') : '/api';

  const clear = () => {
    setName('');
    setEmail('');
    setPassword('');
    setMis('');
    setEmployeeId('');
  };

  async function handleSignUp(e?: React.FormEvent) {
    e?.preventDefault();
    setMessage(null);

    // Basic frontend validation
    if (!name.trim()) {
      setMessage('Name is required.');
      return;
    }
    if (!email.trim()) {
      setMessage('Email is required.');
      return;
    }
    if (!password || password.length < 6) {
      setMessage('Password must be at least 6 characters.');
      return;
    }
    if (role === 'student' && !mis.trim()) {
      setMessage('MIS is required for students.');
      return;
    }
    if (role === 'teacher' && !employee_id.trim()) {
      setMessage('Employee ID is required for teachers.');
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        email: email,
        password: password,
        name: name,
        role: role,
      };

      if (role === 'student') payload.mis = mis;
      else payload.employee_id = employee_id;

      const resp = await fetch(`${apiBase}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        let errText = '';
        try {
          const j = await resp.json();
          errText = j?.error ?? JSON.stringify(j);
        } catch {
          errText = await resp.text();
        }
        setMessage(`Registration failed: ${resp.status} ${errText}`);
        setLoading(false);
        return;
      }

      const json = await resp.json();
      setMessage(json?.message ?? 'Account created. Check email for verification if enabled.');

      clear();

      if (onAfterSignUp) {
        onAfterSignUp();
      } else {
        navigate('/signin');
      }
    } catch (err: any) {
      setMessage('Network or server error while registering: ' + (err?.message ?? String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Create Account</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Join Scrutiny to start your journey</p>
      </div>

      <form onSubmit={handleSignUp} className="space-y-4">
        <Input
          label="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Doe"
          required
          autoComplete="name"
        />

        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 6 characters"
          required
          autoComplete="new-password"
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Role</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setRole('student')}
              className={`flex items-center justify-center px-4 py-2 border rounded-lg text-sm font-medium transition-all ${
                role === 'student'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-500'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => setRole('teacher')}
              className={`flex items-center justify-center px-4 py-2 border rounded-lg text-sm font-medium transition-all ${
                role === 'teacher'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-500'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              Teacher
            </button>
          </div>
        </div>

        {role === 'student' ? (
          <Input
            label="MIS Number"
            value={mis}
            onChange={(e) => setMis(e.target.value)}
            placeholder="e.g. 112233144"
            required
            autoComplete="off"
          />
        ) : (
          <Input
            label="Employee ID"
            value={employee_id}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="e.g. EMP-4567"
            required
            autoComplete="off"
          />
        )}

        {message && (
          <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
            message.includes('failed') || message.includes('error')
              ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
              : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
          }`}>
            <AlertCircle className="w-4 h-4" />
            {message}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full" icon={<UserPlus className="w-4 h-4" />}>
          Create Account
        </Button>
      </form>
    </div>
  );
}
