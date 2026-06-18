'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, getToken } from '@/lib/api';

interface Bullet {
  id: string;
  text: string;
  company: string | null;
  role: string | null;
  skills: string[];
  category: string | null;
}

interface Variant {
  id: string;
  name: string;
  slug: string;
  _count: { bullets: number };
}

export default function CvPage() {
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const [b, v] = await Promise.all([
        api<Bullet[]>('/bullets'),
        api<Variant[]>('/bullets/variants'),
      ]);
      setBullets(b);
      setVariants(v);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErr(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/bullets/upload-cv`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Upload failed: ${body}`);
      }

      const data = await res.json();
      setUploadResult(`Extracted ${data.bulletsExtracted} bullets from your CV`);
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function deleteBullet(id: string) {
    try {
      await api(`/bullets/${id}`, { method: 'DELETE' });
      setBullets(bullets.filter(b => b.id !== id));
    } catch (e: any) {
      setErr(e.message);
    }
  }

  // Group bullets by company
  const grouped = bullets.reduce((acc, b) => {
    const key = b.company || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {} as Record<string, Bullet[]>);

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-5">

      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/jds" className="text-xs text-neutral-400 hover:text-neutral-700">← Dashboard</Link>
          <span className="text-neutral-300">/</span>
          <span className="font-semibold">CV Bullets</span>
        </div>
      </header>

      {/* Upload section */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-medium">Upload CV (PDF)</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Upload your CV and the AI will extract bullets, tag skills, and embed them for RAG matching.
            </p>
          </div>
          <label className={`px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
            uploading
              ? 'bg-neutral-100 text-neutral-400'
              : 'bg-neutral-900 text-white hover:bg-neutral-800'
          }`}>
            {uploading ? 'Processing...' : 'Upload PDF'}
            <input
              type="file"
              accept="application/pdf"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {uploading && (
          <div className="flex items-center gap-2 text-xs text-neutral-400 animate-pulse">
            <span>Extracting text → parsing bullets → embedding...</span>
            <span>This takes 1-2 minutes.</span>
          </div>
        )}

        {uploadResult && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
            ✓ {uploadResult}
          </div>
        )}

        {err && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">{err}</div>
        )}
      </div>

      {/* Variants summary */}
      {variants.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {variants.map(v => (
            <span key={v.id} className="px-3 py-1.5 text-xs bg-neutral-100 text-neutral-600 rounded-lg font-medium">
              {v.name} ({v._count.bullets} bullets)
            </span>
          ))}
        </div>
      )}

      {/* Bullets grouped by company */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-neutral-200 rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-neutral-200 rounded w-1/4 mb-3" />
              <div className="h-3 bg-neutral-100 rounded w-full mb-2" />
              <div className="h-3 bg-neutral-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-400 text-sm">No bullets yet.</p>
          <p className="text-neutral-300 text-xs mt-1">Upload a CV to extract bullets automatically.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([company, companyBullets]) => (
            <div key={company} className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-200">
                <p className="text-sm font-medium">{company}</p>
                <p className="text-xs text-neutral-400">{companyBullets[0]?.role ?? ''} · {companyBullets.length} bullets</p>
              </div>
              {companyBullets.map(bullet => (
                <div key={bullet.id} className="px-5 py-3 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 group">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-neutral-700 leading-relaxed flex-1">{bullet.text}</p>
                    <button
                      onClick={() => deleteBullet(bullet.id)}
                      className="text-xs text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                  {bullet.skills.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {bullet.skills.map(s => (
                        <span key={s} className="px-2 py-0.5 text-[10px] bg-neutral-100 text-neutral-500 rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-neutral-300 text-center">
        {bullets.length} bullets across {variants.length} variants · Embeddings stored in pgvector
      </p>
    </main>
  );
}