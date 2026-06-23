'use client';

import { KeywordPanels } from '@/components/jd/KeywordPanels';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { JdHeader } from '@/components/jd/JdHeader';
import { Tabs, type ActiveTab } from '@/components/jd/Tabs';
import { RewritesTab } from '@/components/jd/RewritesTab';
import { CoverLetterTab } from '@/components/jd/CoverLetterTab';
import { VersionSwitcher } from '@/components/jd/VersionSwitcher';

// ---------- Types ----------
interface RewriteItem {
  id: string;
  bulletId: string;
  original: string;
  rewritten: string;
  company: string | null;
  distance: number;
  accepted: boolean;
}

interface RewriteSet {
  id: string;
  createdAt: string;
  provider: string | null;
  model: string | null;
  items: RewriteItem[];
}

interface CoverLetterGen {
  id: string;
  content: string;
  language: string;
  provider: string | null;
  createdAt: string;
}

interface CompileResult {
  latex: string;
  plainText: string;
  bulletCount: number;
}

interface Analysis {
  matchScore: number;
  semanticScore: number;
  keywordScore: number;
  matched: { mustHaves: string[]; niceToHaves: string[] };
  missing: { mustHaves: string[] };
  redFlags: string[];
}

interface JD {
  id: string;
  companyName: string | null;
  roleTitle: string | null;
  location: string | null;
  language: string | null;
  germanLevel: string | null;
  workFormat: string | null;
  rawText: string;
  extracted: any;
  status?: string;
}

// ---------- Helpers ----------

const STATUS_OPTIONS = ['captured', 'applied', 'interview', 'offer', 'rejected'];
const STATUS_COLORS: Record<string, string> = {
  captured: 'bg-neutral-100 text-neutral-600',
  applied: 'bg-blue-50 text-blue-700',
  interview: 'bg-emerald-50 text-emerald-700',
  offer: 'bg-green-100 text-green-700',
  rejected: 'bg-red-50 text-red-600',
};

// ---------- Component ----------

export default function JdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [jd, setJd] = useState<JD | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [rewriteSet, setRewriteSet] = useState<RewriteSet | null>(null);
  const [coverLetterGen, setCoverLetterGen] = useState<CoverLetterGen | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingRewrites, setLoadingRewrites] = useState(false);
  const [loadingLetter, setLoadingLetter] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('rewrites');
  const [rewriteHistory, setRewriteHistory] = useState<RewriteSet[]>([]);
  const [coverLetterHistory, setCoverLetterHistory] = useState<CoverLetterGen[]>([]);
  const [compilingCv, setCompilingCv] = useState(false);
  const [compiledCv, setCompiledCv] = useState<CompileResult | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);

  useEffect(() => {
    api<JD>(`/jds/${id}`).then(setJd).catch(console.error);
  }, [id]);

  useEffect(() => {
    if (!jd) return;
    setLoadingAnalysis(true);
    api<Analysis>(`/jds/${id}/analyze`)
      .then(setAnalysis)
      .catch(console.error)
      .finally(() => setLoadingAnalysis(false));
  }, [jd, id]);

  // Load saved rewrites and cover letter
  useEffect(() => {
    if (!jd) return;
    api<RewriteSet[]>(`/jds/${id}/rewrites/history`)
      .then((data) => {
        setRewriteHistory(data ?? []);
        if (data?.length > 0) setRewriteSet(data[0]); // latest
      })
      .catch(console.error);
    api<CoverLetterGen[]>(`/jds/${id}/cover-letter/history`)
      .then((data) => {
        setCoverLetterHistory(data ?? []);
        if (data?.length > 0) setCoverLetterGen(data[0]); // latest
      })
      .catch(console.error);
  }, [jd, id]);

  async function generateRewrites() {
    setActiveTab('rewrites');
    setLoadingRewrites(true);
    try {
      const res = await api<RewriteSet>(`/jds/${id}/suggest-rewrites`, { method: 'POST' });
      setRewriteSet(res);
      // Refresh history
      const history = await api<RewriteSet[]>(`/jds/${id}/rewrites/history`);
      setRewriteHistory(history ?? []);
    } finally {
      setLoadingRewrites(false);
    }
  }

  async function generateCoverLetter() {
    setActiveTab('letter');
    setLoadingLetter(true);
    try {
      const res = await api<CoverLetterGen>(`/jds/${id}/cover-letter`, { method: 'POST' });
      setCoverLetterGen(res);
      // Refresh history
      const history = await api<CoverLetterGen[]>(`/jds/${id}/cover-letter/history`);
      setCoverLetterHistory(history ?? []);
    } finally {
      setLoadingLetter(false);
    }
  }

  async function updateStatus(newStatus: string) {
    setStatusUpdating(true);
    try {
      await api(`/jds/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      setJd(jd ? { ...jd, status: newStatus } : null);
    } finally {
      setStatusUpdating(false);
    }
  }

  function switchRewriteVersion(setId: string) {
    const found = rewriteHistory.find(s => s.id === setId);
    if (found) setRewriteSet(found);
  }

  function switchCoverLetterVersion(genId: string) {
    const found = coverLetterHistory.find(g => g.id === genId);
    if (found) setCoverLetterGen(found);
  }

  async function toggleAccept(itemId: string) {
    if (!rewriteSet) return;
    const item = rewriteSet.items.find(i => i.id === itemId);
    if (!item) return;

    const newAccepted = !item.accepted;

    // Optimistic update
    setRewriteSet({
      ...rewriteSet,
      items: rewriteSet.items.map(i =>
        i.id === itemId ? { ...i, accepted: newAccepted } : i
      ),
    });

    // Persist to server
    try {
      await api(`/jds/rewrites/items/${itemId}/accept`, {
        method: 'PATCH',
        body: JSON.stringify({ accepted: newAccepted }),
      });
    } catch {
      // Revert on failure
      setRewriteSet({
        ...rewriteSet,
        items: rewriteSet.items.map(i =>
          i.id === itemId ? { ...i, accepted: !newAccepted } : i
        ),
      });
    }
  }

  function copyToClipboard() {
    if (!coverLetterGen) return;
    navigator.clipboard.writeText(coverLetterGen.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadTextFile(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    link.remove();
    URL.revokeObjectURL(url);
  }

  async function compileTailoredCv() {
    if (!jd) return;

    setCompilingCv(true);
    setCompileError(null);

    try {
      const result = await api<CompileResult>(`/bullets/compile/${id}`, {
        method: 'POST',
      });

      setCompiledCv(result);

      const roleSlug = (jd.roleTitle ?? 'tailored-cv')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const companySlug = (jd.companyName ?? 'company')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      downloadTextFile(
        `${companySlug}-${roleSlug || 'tailored-cv'}.tex`,
        result.latex,
        'application/x-tex;charset=utf-8',
      );
    } catch (err) {
      setCompileError(err instanceof Error ? err.message : 'Failed to compile tailored CV');
    } finally {
      setCompilingCv(false);
    }
  }

  function downloadCompiledPlainText() {
    if (!compiledCv || !jd) return;

    const roleSlug = (jd.roleTitle ?? 'tailored-cv')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const companySlug = (jd.companyName ?? 'company')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    downloadTextFile(
      `${companySlug}-${roleSlug || 'tailored-cv'}.txt`,
      compiledCv.plainText,
      'text/plain;charset=utf-8',
    );
  }

  if (!jd) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-neutral-200 rounded w-20" />
          <div className="h-8 bg-neutral-200 rounded w-2/3" />
          <div className="h-4 bg-neutral-100 rounded w-1/3" />
          <div className="grid grid-cols-3 gap-3 pt-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-neutral-100 rounded-xl" />)}
          </div>
        </div>
      </main>
    );
  }

  const status = jd.status || 'captured';
  const rewrites = rewriteSet?.items ?? null;
  const accepted = Object.fromEntries(
    (rewriteSet?.items ?? []).map(i => [i.bulletId, i.accepted])
  );
  const acceptedCount = (rewriteSet?.items ?? []).filter(i => i.accepted).length;
  const coverLetter = coverLetterGen?.content ?? null;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-5">

      {/* Nav bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Link href="/jds" className="hover:text-neutral-700">← Back</Link>
          <span>/</span>
          <span className="text-neutral-600">{jd.roleTitle ?? 'Untitled'}</span>
        </div>
        <select
          value={status}
          onChange={(e) => updateStatus(e.target.value)}
          disabled={statusUpdating}
          className={`px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-50 cursor-pointer ${STATUS_COLORS[status]}`}
        >
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {/* Header with score */}
      <JdHeader jd={jd} analysis={analysis} />

      {/* Keywords */}
      <KeywordPanels loadingAnalysis={loadingAnalysis} analysis={analysis} />

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        rewritesLabel={`Tailored CV ${rewrites ? `(${acceptedCount}/${rewrites.length})` : ''
          }`}
        letterLabel={`Cover Letter ${coverLetter ? '✓' : ''}`}
      />

      {activeTab === 'rewrites' && (
        <>
          {rewriteSet && rewriteHistory.length > 1 && (
            <div className="flex justify-end">
              <VersionSwitcher
                versions={rewriteHistory}
                activeId={rewriteSet.id}
                onSelect={switchRewriteVersion}
              />
            </div>
          )}
          <RewritesTab
            rewrites={rewrites ? rewrites.map(i => ({
              bulletId: i.id,
              company: i.company,
              original: i.original,
              rewritten: i.rewritten,
              distance: i.distance,
            })) : null}
            loading={loadingRewrites}
            onGenerate={generateRewrites}
            accepted={Object.fromEntries(
              (rewriteSet?.items ?? []).map(i => [i.id, i.accepted])
            )}
            acceptedCount={acceptedCount}
            onToggleAccept={toggleAccept}
          />

          {rewrites && rewrites.length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  Ready to compile your tailored CV
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  Uses your accepted rewrites. If none are accepted, the backend falls back to all rewrites.
                </p>

                {compileError && (
                  <p className="text-xs text-red-600 mt-2">
                    {compileError}
                  </p>
                )}

                {compiledCv && !compileError && (
                  <p className="text-xs text-emerald-700 mt-2">
                    Compiled {compiledCv.bulletCount} tailored bullets.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {compiledCv && (
                  <button
                    onClick={downloadCompiledPlainText}
                    className="text-xs text-neutral-500 hover:text-neutral-700 px-3 py-2 border border-neutral-200 rounded-lg"
                  >
                    Plain text
                  </button>
                )}

                <button
                  onClick={compileTailoredCv}
                  disabled={compilingCv}
                  className="bg-neutral-900 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  {compilingCv ? 'Compiling...' : 'Download tailored .tex'}
                </button>
              </div>
            </div>
          )}

        </>
      )}

      {activeTab === 'letter' && (
        <>
          {coverLetterGen && coverLetterHistory.length > 1 && (
            <div className="flex justify-end">
              <VersionSwitcher
                versions={coverLetterHistory}
                activeId={coverLetterGen.id}
                onSelect={switchCoverLetterVersion}
              />
            </div>
          )}
          <CoverLetterTab
            coverLetter={coverLetter}
            loading={loadingLetter}
            onGenerate={generateCoverLetter}
            language={jd.language}
            copied={copied}
            onCopy={copyToClipboard}
          />
        </>
      )}

    </main>
  );
}