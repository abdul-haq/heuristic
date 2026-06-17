'use client';

import { RewriteCard } from '@/components/jd/RewriteCard';
import { KeywordPanels } from '@/components/jd/KeywordPanels';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { JdHeader } from '@/components/jd/JdHeader';
import { Tabs, type ActiveTab } from '@/components/jd/Tabs';
import { RewritesTab } from '@/components/jd/RewritesTab';
import { CoverLetterTab } from '@/components/jd/CoverLetterTab';

// ---------- Types ----------

interface Rewrite {
  bulletId: string;
  original: string;
  rewritten: string;
  company: string | null;
  distance: number;
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
  const [rewrites, setRewrites] = useState<Rewrite[] | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingRewrites, setLoadingRewrites] = useState(false);
  const [loadingLetter, setLoadingLetter] = useState(false);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('rewrites');

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

  async function generateRewrites() {
    setActiveTab('rewrites');
    setLoadingRewrites(true);
    try {
      const res = await api<{ rewrites: Rewrite[] }>(`/jds/${id}/suggest-rewrites`, { method: 'POST' });
      setRewrites(res.rewrites);
    } finally {
      setLoadingRewrites(false);
    }
  }

  async function generateCoverLetter() {
    setActiveTab('letter');
    setLoadingLetter(true);
    try {
      const res = await api<{ coverLetter: string }>(`/jds/${id}/cover-letter`, { method: 'POST' });
      setCoverLetter(res.coverLetter);
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

  function copyToClipboard() {
    if (!coverLetter) return;
    navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  const e = jd.extracted ?? {};
  const status = jd.status || 'captured';
  const acceptedCount = Object.values(accepted).filter(Boolean).length;

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
          <RewritesTab
            rewrites={rewrites}
            loading={loadingRewrites}
            onGenerate={generateRewrites}
            accepted={accepted}
            acceptedCount={acceptedCount}
            onToggleAccept={(bulletId) =>
              setAccepted((prev) => ({
                ...prev,
                [bulletId]: !prev[bulletId],
              }))
            }
          />
      )}

      {activeTab === 'letter' && (
          <CoverLetterTab
            coverLetter={coverLetter}
            loading={loadingLetter}
            onGenerate={generateCoverLetter}
            language={jd.language}
            copied={copied}
            onCopy={copyToClipboard}
          />
      )}

    </main>
  );
}