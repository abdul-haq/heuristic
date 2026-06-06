'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface JD {
  id: string;
  companyName: string | null;
  roleTitle: string | null;
  location: string | null;
  language: string | null;
  germanLevel: string | null;
  platform: string | null;
  createdAt: string;
}

export default function JdsPage() {
  const [jds, setJds] = useState<JD[]>([]);
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      setJds(await api<JD[]>('/jds'));
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function capture() {
    if (!rawText.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      await api('/jds', { method: 'POST', body: JSON.stringify({ rawText, platform: 'manual' }) });
      setRawText('');
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium">Job descriptions</h1>
        <Link href="/" className="text-xs text-neutral-500">Sign out</Link>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium">Paste a JD</p>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste the full text of the job description here..."
          className="w-full h-40 border border-neutral-300 rounded p-3 text-sm font-mono"
        />
        {err && <p className="text-xs text-red-600">{err}</p>}
        <button onClick={capture} disabled={loading} className="bg-neutral-900 text-white rounded px-4 py-2 text-sm disabled:opacity-50">
          {loading ? 'Analyzing...' : 'Capture & analyze'}
        </button>
      </div>

      <div className="space-y-2">
        {jds.length === 0 && <p className="text-sm text-neutral-500">No JDs yet. Paste one above.</p>}
        {jds.map((jd) => (
          <Link key={jd.id} href={`/jds/${jd.id}`} className="block bg-white border border-neutral-200 rounded-lg p-4 hover:border-neutral-400">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-sm">{jd.roleTitle ?? 'Untitled role'}</p>
                <p className="text-xs text-neutral-500">{jd.companyName ?? '?'} · {jd.location ?? '?'}</p>
              </div>
              <div className="flex gap-2 text-xs text-neutral-500">
                {jd.language && <span className="uppercase">{jd.language}</span>}
                {jd.germanLevel && <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded">DE {jd.germanLevel}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
