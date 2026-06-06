'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('abdulhaq.dev@gmail.com');
  const [password, setPassword] = useState('changeme123');
  const [name, setName] = useState('Abdul Haq');
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
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 bg-white p-6 rounded-lg border border-neutral-200">
        <h1 className="text-xl font-medium">Heuristic</h1>
        <p className="text-sm text-neutral-500">{mode === 'login' ? 'Log in' : 'Create an account'}</p>

        {mode === 'signup' && (
          <input className="w-full border border-neutral-300 rounded px-3 py-2 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input className="w-full border border-neutral-300 rounded px-3 py-2 text-sm" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border border-neutral-300 rounded px-3 py-2 text-sm" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button disabled={loading} className="w-full bg-neutral-900 text-white rounded py-2 text-sm disabled:opacity-50">
          {loading ? '...' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>

        <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="w-full text-xs text-neutral-500">
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
        </button>
      </form>
    </main>
  );
}
