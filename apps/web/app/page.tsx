'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await api<{ token: string }>(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ email, password, ...(mode === 'signup' ? { name } : {}) }),
      });
      setToken(res.token);
      router.push('/jds');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-neutral-50">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center">
            <span className="text-white font-semibold">H</span>
          </div>
          <span className="text-xl font-semibold">Heuristic</span>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
          <p className="text-sm text-neutral-500">
            {mode === 'login' ? 'Log in to your account' : 'Create a new account'}
          </p>

          {mode === 'signup' && (
            <input
              className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-400 transition-colors"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-400 transition-colors"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-400 transition-colors"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {err && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">{err}</div>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full bg-neutral-900 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-neutral-800 transition-colors"
          >
            {loading ? '...' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="w-full text-xs text-neutral-400 hover:text-neutral-600"
          >
            {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
          </button>
        </div>
      </div>
    </main>
  );
}