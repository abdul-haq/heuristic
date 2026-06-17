'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, clearToken } from '@/lib/api';

interface JD {
  id: string;
  companyName: string | null;
  roleTitle: string | null;
  location: string | null;
  language: string | null;
  germanLevel: string | null;
  workFormat: string | null;
  platform: string | null;
  status?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  captured: 'bg-neutral-100 text-neutral-600',
  applied: 'bg-blue-50 text-blue-700',
  interview: 'bg-emerald-50 text-emerald-700',
  offer: 'bg-green-100 text-green-700',
  rejected: 'bg-red-50 text-red-600',
};

export default function JdsPage() {
  const [jds, setJds] = useState<JD[]>([]);
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showCapture, setShowCapture] = useState(false);

  async function refresh() {
    try { setJds(await api<JD[]>('/jds')); }
    catch (e: any) { setErr(e.message); }
    finally { setInitialLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  async function capture() {
    if (!rawText.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      await api('/jds', { method: 'POST', body: JSON.stringify({ rawText, platform: 'manual' }) });
      setRawText('');
      setShowCapture(false);
      await refresh();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function deleteJd(jdId: string) {
    setDeletingId(jdId);
    try {
      await api(`/jds/${jdId}`, { method: 'DELETE' });
      setJds(jds.filter(j => j.id !== jdId));
    } catch (e: any) { setErr(e.message); }
    finally { setDeletingId(null); }
  }

  async function updateStatus(jdId: string, newStatus: string) {
    setUpdatingId(jdId);
    try {
      await api(`/jds/${jdId}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      setJds(jds.map(j => j.id === jdId ? { ...j, status: newStatus } : j));
    } catch (e: any) { setErr(e.message); }
    finally { setUpdatingId(null); }
  }

  const total = jds.length;
  const applied = jds.filter(j => ['applied', 'interview', 'offer'].includes(j.status || '')).length;
  const interviews = jds.filter(j => j.status === 'interview').length;
  const offers = jds.filter(j => j.status === 'offer').length;
  const callbackRate = total > 0 ? Math.round((interviews / total) * 100) : 0;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-5">

      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-neutral-900 rounded-xl flex items-center justify-center">
            <span className="text-white text-sm font-semibold">H</span>
          </div>
          <span className="font-semibold text-lg">Heuristic</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500">Abdul</span>
          <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">AH</div>
          <button
            onClick={() => { clearToken(); window.location.href = '/'; }}
            className="text-xs text-neutral-400 hover:text-neutral-700 ml-2"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <p className="text-xs text-neutral-400">Applications</p>
          <p className="text-2xl font-semibold mt-1">{total}</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <p className="text-xs text-neutral-400">Callbacks</p>
          <p className="text-2xl font-semibold mt-1">{interviews} <span className="text-sm text-neutral-400 font-normal">/ {callbackRate}%</span></p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <p className="text-xs text-neutral-400">Interviews</p>
          <p className="text-2xl font-semibold mt-1">{interviews}</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <p className="text-xs text-neutral-400">Offers</p>
          <p className="text-2xl font-semibold mt-1">{offers}</p>
        </div>
      </div>

      {/* Capture */}
      {!showCapture ? (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Recent applications</p>
          <button
            onClick={() => setShowCapture(true)}
            className="px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:border-neutral-400 transition-colors"
          >
            + Capture JD
          </button>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Paste a JD</p>
            <button onClick={() => setShowCapture(false)} className="text-xs text-neutral-400 hover:text-neutral-600">Cancel</button>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste the full text of the job description here..."
            className="w-full h-40 border border-neutral-200 rounded-lg p-3 text-sm bg-white text-neutral-900 focus:outline-none focus:border-neutral-400"
            disabled={loading}
            autoFocus
          />
          {err && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">{err}</div>}
          <div className="flex items-center gap-3">
            <button
              onClick={capture}
              disabled={loading || !rawText.trim()}
              className="bg-neutral-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Capture & analyze'}
            </button>
            {loading && <span className="text-xs text-neutral-400 animate-pulse">Extracting fields — takes 30-60s...</span>}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-neutral-50 border-b border-neutral-200 text-xs text-neutral-400 font-medium">
          <div className="col-span-4">Role / Company</div>
          <div className="col-span-2">Platform</div>
          <div className="col-span-2 text-center">Match</div>
          <div className="col-span-2 text-center">Status</div>
          <div className="col-span-1 text-center">Lang</div>
          <div className="col-span-1"></div>
        </div>

        {/* Loading */}
        {initialLoading && [1, 2, 3].map(i => (
          <div key={i} className="grid grid-cols-12 gap-2 px-5 py-4 border-b border-neutral-100 animate-pulse">
            <div className="col-span-4"><div className="h-4 bg-neutral-200 rounded w-3/4 mb-1" /><div className="h-3 bg-neutral-100 rounded w-1/2" /></div>
            <div className="col-span-2"><div className="h-4 bg-neutral-100 rounded w-1/2" /></div>
            <div className="col-span-2 flex justify-center"><div className="h-6 w-10 bg-neutral-100 rounded" /></div>
            <div className="col-span-2 flex justify-center"><div className="h-6 w-16 bg-neutral-100 rounded" /></div>
            <div className="col-span-1 flex justify-center"><div className="h-4 w-6 bg-neutral-100 rounded" /></div>
            <div className="col-span-1"></div>
          </div>
        ))}

        {/* Empty state */}
        {!initialLoading && jds.length === 0 && (
          <div className="text-center py-16">
            <p className="text-neutral-400 text-sm">No job descriptions yet.</p>
            <p className="text-neutral-300 text-xs mt-1">Click "+ Capture JD" to get started.</p>
          </div>
        )}

        {/* Rows */}
        {!initialLoading && jds.map((jd) => {
          const status = jd.status || 'captured';
          return (
            <div key={jd.id} className="grid grid-cols-12 gap-2 px-5 py-4 border-b border-neutral-100 hover:bg-neutral-50 transition-colors items-center">
              {/* Role / Company */}
              <Link href={`/jds/${jd.id}`} className="col-span-4 min-w-0">
                <p className="text-sm font-medium truncate">{jd.roleTitle ?? 'Untitled role'}</p>
                <p className="text-xs text-neutral-400 truncate">{jd.companyName ?? 'Unknown'} · {jd.location ?? '?'}</p>
              </Link>

              {/* Platform */}
              <div className="col-span-2">
                <span className="text-sm text-neutral-500 capitalize">{jd.platform ?? '—'}</span>
              </div>

              {/* Match */}
              <div className="col-span-2 flex justify-center">
                <span className="text-xs font-medium text-neutral-400">—</span>
              </div>

              {/* Status */}
              <div className="col-span-2 flex justify-center">
                <select
                  value={status}
                  onChange={(e) => updateStatus(jd.id, e.target.value)}
                  disabled={updatingId === jd.id}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium border-0 cursor-pointer disabled:opacity-50 ${STATUS_COLORS[status]}`}
                >
                  <option value="captured">Captured</option>
                  <option value="applied">Applied</option>
                  <option value="interview">Interview</option>
                  <option value="offer">Offer</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Lang */}
              <div className="col-span-1 flex justify-center">
                <span className="text-xs text-neutral-400 uppercase">{jd.language ?? '—'}</span>
              </div>

              {/* Delete */}
              <div className="col-span-1 flex justify-end">
                <button
                  onClick={() => deleteJd(jd.id)}
                  disabled={deletingId === jd.id}
                  className="text-xs text-neutral-300 hover:text-red-500 disabled:opacity-50 transition-colors"
                >
                  {deletingId === jd.id ? '...' : '✕'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}