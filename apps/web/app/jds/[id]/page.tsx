'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Rewrite {
  bulletId: string;
  original: string;
  rewritten: string;
  company: string | null;
  distance: number;
}

interface JD {
  id: string;
  companyName: string | null;
  roleTitle: string | null;
  location: string | null;
  rawText: string;
  extracted: any;
}

export default function JdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [jd, setJd] = useState<JD | null>(null);
  const [rewrites, setRewrites] = useState<Rewrite[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api<JD>(`/jds/${id}`).then(setJd).catch(console.error);
  }, [id]);

  async function generate() {
    setLoading(true);
    try {
      const res = await api<{ rewrites: Rewrite[] }>(`/jds/${id}/suggest-rewrites`, { method: 'POST' });
      setRewrites(res.rewrites);
    } finally {
      setLoading(false);
    }
  }

  if (!jd) return <main className="p-6 text-sm text-neutral-500">Loading...</main>;

  const e = jd.extracted ?? {};

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <Link href="/jds" className="text-xs text-neutral-500">← Back to JDs</Link>

      <header>
        <h1 className="text-xl font-medium">{jd.roleTitle ?? 'Untitled'}</h1>
        <p className="text-sm text-neutral-500">{jd.companyName ?? '?'} · {jd.location ?? '?'}</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Must-haves</p>
          <div className="flex flex-wrap gap-1">
            {(e.mustHaves ?? []).map((s: string) => (
              <span key={s} className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-900 rounded">{s}</span>
            ))}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Nice-to-haves</p>
          <div className="flex flex-wrap gap-1">
            {(e.niceToHaves ?? []).map((s: string) => (
              <span key={s} className="px-2 py-0.5 text-xs bg-neutral-100 text-neutral-700 rounded">{s}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Tailored bullet suggestions</h2>
        <button onClick={generate} disabled={loading} className="bg-neutral-900 text-white rounded px-3 py-1.5 text-sm disabled:opacity-50">
          {loading ? 'Generating...' : rewrites ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      <div className="space-y-3">
        {rewrites?.map((r) => (
          <div key={r.bulletId} className="bg-white border border-neutral-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs text-neutral-500">{r.company} · similarity {(1 - r.distance).toFixed(2)}</p>
              <button
                onClick={() => setAccepted({ ...accepted, [r.bulletId]: !accepted[r.bulletId] })}
                className={`text-xs px-2 py-1 rounded ${accepted[r.bulletId] ? 'bg-emerald-600 text-white' : 'border border-neutral-300'}`}
              >
                {accepted[r.bulletId] ? '✓ Accepted' : 'Accept'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Original</p>
                <p className="text-neutral-700">{r.original}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-emerald-700 mb-1">Tailored</p>
                <p>{r.rewritten}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
