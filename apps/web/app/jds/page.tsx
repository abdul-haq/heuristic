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
  platform: string | null;
  createdAt: string;
  status?: string;
}
const STATUS_COLORS: Record<string, string> = {
  captured: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  applied: 'bg-blue-50 text-blue-700 border-blue-300',
  interview: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  offer: 'bg-green-50 text-green-700 border-green-300',
  rejected: 'bg-red-50 text-red-700 border-red-300',
};
export default function JdsPage() {
  const [jds, setJds] = useState<JD[]>([]);
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  async function updateStatus(jdId: string, newStatus: string) {
    setUpdatingId(jdId);
    try {
      await api(`/jds/${jdId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      // Update the local list
      setJds(jds.map(j => j.id === jdId ? { ...j, status: newStatus } : j));
    } catch (err: any) {
      setErr(err.message);
    } finally {
      setUpdatingId(null);
    }
  }
  async function deleteJd(jdId: string, e: React.MouseEvent) {
    e.preventDefault(); // Don't navigate if accidentally clicked while hovering the link
    setDeletingId(jdId);
    try {
      await api(`/jds/${jdId}`, { method: 'DELETE' });
      // Remove from the UI immediately (optimistic update)
      setJds(jds.filter(j => j.id !== jdId));
    } catch (err: any) {
      setErr(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function refresh() {
    try {
      setJds(await api<JD[]>('/jds'));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setInitialLoading(false);
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
      <header className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-medium">H</span>
          </div>
          <span className="font-medium">Heuristic</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-neutral-500">abdulhaq.dev@gmail.com</span>
          <button
            onClick={() => { clearToken(); window.location.href = '/'; }}
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium">Paste a JD</p>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste the full text of the job description here..."
          className="w-full h-40 border border-neutral-300 rounded p-3 text-sm font-mono focus:outline-none focus:border-neutral-500"
          disabled={loading}
        />
        {err && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700">
            {err}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={capture}
            disabled={loading || !rawText.trim()}
            className="bg-neutral-900 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Capture & analyze'}
          </button>
          {loading && (
            <span className="text-xs text-neutral-500 animate-pulse">
              Extracting fields with LLM — this might take some seconds ...
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {initialLoading && (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-neutral-200 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-neutral-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-neutral-100 rounded w-1/3" />
              </div>
            ))}
          </>
        )}
        {!initialLoading && jds.length === 0 && (
          <p className="text-sm text-neutral-500">No JDs yet. Paste one above.</p>
        )}
        {!initialLoading && jds.map((jd) => (
          <div key={jd.id} className="flex items-center justify-between gap-3 bg-white border border-neutral-200 rounded-lg p-4 hover:border-neutral-400">
            <Link href={`/jds/${jd.id}`} className="flex-1">
              <div>
                <p className="font-medium text-sm">{jd.roleTitle ?? 'Untitled role'}</p>
                <p className="text-xs text-neutral-500">{jd.companyName ?? '?'} · {jd.location ?? '?'}</p>
              </div>
            </Link>
            <div className="flex gap-2 text-xs text-neutral-500">
              {jd.language && <span className="uppercase">{jd.language}</span>}
              {jd.germanLevel && <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded">DE {jd.germanLevel}</span>}
            </div>

            {/* Status dropdown */}
            <select
              value={jd.status || 'captured'}
              onChange={(e) => updateStatus(jd.id, e.target.value)}
              disabled={updatingId === jd.id}
              className={`px-2 py-1.5 text-xs border rounded font-medium disabled:opacity-50 ${STATUS_COLORS[jd.status || 'captured']}`}
            >
              <option value="captured">Captured</option>
              <option value="applied">Applied</option>
              <option value="interview">Interview</option>
              <option value="offer">Offer</option>
              <option value="rejected">Rejected</option>
            </select>

            {/* Delete button */}
            <button
              onClick={(e) => deleteJd(jd.id, e)}
              className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
              disabled={deletingId === jd.id}
            >
              {deletingId === jd.id ? '...' : 'Delete'}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
