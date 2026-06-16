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

interface Analysis {
  matchScore: number;
  semanticScore: number;
  keywordScore: number;
  matched: { mustHaves: string[]; niceToHaves: string[] };
  missing: { mustHaves: string[] };
  redFlags: string[];
  userSkills: string[];
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
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color =
    score >= 75 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    score >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200' :
    'text-red-700 bg-red-50 border-red-200';

  return (
    <div className={`border rounded-lg p-3 text-center ${color}`}>
      <p className="text-2xl font-semibold">{score}</p>
      <p className="text-xs mt-1">{label}</p>
    </div>
  );
}

export default function JdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [jd, setJd] = useState<JD | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [rewrites, setRewrites] = useState<Rewrite[] | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingRewrites, setLoadingRewrites] = useState(false);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [loadingLetter, setLoadingLetter] = useState(false);
  const [copied, setCopied] = useState(false);


  useEffect(() => {
    api<JD>(`/jds/${id}`).then(setJd).catch(console.error);
  }, [id]);

  // Auto-run analysis when JD loads
  useEffect(() => {
    if (!jd) return;
    setLoadingAnalysis(true);
    api<Analysis>(`/jds/${id}/analyze`)
      .then(setAnalysis)
      .catch(console.error)
      .finally(() => setLoadingAnalysis(false));
  }, [jd, id]);

  async function generateRewrites() {
    setLoadingRewrites(true);
    try {
      const res = await api<{ rewrites: Rewrite[] }>(`/jds/${id}/suggest-rewrites`, { method: 'POST' });
      setRewrites(res.rewrites);
    } finally {
      setLoadingRewrites(false);
    }
  }

  async function generateCoverLetter() {
    setLoadingLetter(true);
    try {
      const res = await api<{ coverLetter: string }>(`/jds/${id}/cover-letter`, { method: 'POST' });
      setCoverLetter(res.coverLetter);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingLetter(false);
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
          <div className="h-4 bg-neutral-200 rounded w-1/4" />
          <div className="h-8 bg-neutral-200 rounded w-2/3" />
          <div className="h-4 bg-neutral-100 rounded w-1/3" />
        </div>
      </main>
    );
  }

  const e = jd.extracted ?? {};

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <Link href="/jds" className="text-xs text-neutral-500 hover:text-neutral-900">← Back to JDs</Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-medium">{jd.roleTitle ?? 'Untitled role'}</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {jd.companyName ?? 'Unknown company'} · {jd.location ?? 'Location not specified'}
            {jd.language && <span className="ml-2 uppercase text-xs">{jd.language}</span>}
          </p>
        </div>
        {jd.workFormat && (
          <span className={`px-3 py-1 text-xs rounded-full font-medium ${
            jd.workFormat === 'werkstudent' ? 'bg-emerald-50 text-emerald-700' :
            jd.workFormat === 'fulltime' ? 'bg-amber-50 text-amber-700' :
            'bg-neutral-100 text-neutral-700'
          }`}>
            {jd.workFormat}
          </span>
        )}
      </div>

      {/* Scores */}
      {loadingAnalysis ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-neutral-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : analysis ? (
        <div className="grid grid-cols-3 gap-3">
          <ScoreBadge score={analysis.matchScore} label="Overall match" />
          <ScoreBadge score={analysis.semanticScore} label="Semantic fit" />
          <ScoreBadge score={analysis.keywordScore} label="Keyword coverage" />
        </div>
      ) : null}

      {/* Red flags */}
      {analysis && analysis.redFlags.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-1">
          {analysis.redFlags.map((flag, i) => (
            <p key={i} className="text-sm text-red-700">⚠ {flag}</p>
          ))}
        </div>
      )}

      {/* Keywords */}
      {analysis && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-neutral-200 rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500 mb-3">Matched keywords</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.matched.mustHaves.map((s) => (
                <span key={s} className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded font-medium">{s}</span>
              ))}
              {analysis.matched.niceToHaves.map((s) => (
                <span key={s} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded">{s}</span>
              ))}
              {analysis.matched.mustHaves.length === 0 && analysis.matched.niceToHaves.length === 0 && (
                <span className="text-xs text-neutral-400">No keyword matches found</span>
              )}
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500 mb-3">Missing from your CV</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.missing.mustHaves.map((s) => (
                <span key={s} className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded">{s}</span>
              ))}
              {analysis.missing.mustHaves.length === 0 && (
                <span className="text-xs text-neutral-400">All keywords covered</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rewrites section */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-sm font-medium">Tailored bullet suggestions</h2>
        <button
          onClick={generateRewrites}
          disabled={loadingRewrites}
          className="bg-neutral-900 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {loadingRewrites ? 'Generating...' : rewrites ? 'Regenerate' : 'Generate rewrites'}
        </button>
      </div>

      {loadingRewrites && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-neutral-200 rounded-lg p-4 animate-pulse">
              <div className="h-3 bg-neutral-100 rounded w-1/4 mb-4" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="h-3 bg-neutral-200 rounded w-full" />
                  <div className="h-3 bg-neutral-200 rounded w-3/4" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-emerald-100 rounded w-full" />
                  <div className="h-3 bg-emerald-100 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
          <p className="text-xs text-neutral-500 animate-pulse text-center">
            Rewriting bullets with LLM — takes 30-60 seconds...
          </p>
        </div>
      )}

      {rewrites && !loadingRewrites && (
        <div className="space-y-3">
          {rewrites.map((r) => (
            <div key={r.bulletId} className="bg-white border border-neutral-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs text-neutral-500">
                  {r.company} · similarity {(1 - r.distance).toFixed(2)}
                </p>
                <button
                  onClick={() => setAccepted({ ...accepted, [r.bulletId]: !accepted[r.bulletId] })}
                  className={`text-xs px-3 py-1 rounded font-medium ${
                    accepted[r.bulletId]
                      ? 'bg-emerald-600 text-white'
                      : 'border border-neutral-300 hover:border-neutral-400'
                  }`}
                >
                  {accepted[r.bulletId] ? '✓ Accepted' : 'Accept'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">Original</p>
                  <p className="text-neutral-500 leading-relaxed">{r.original}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-emerald-600 mb-1">Tailored</p>
                  <p className="leading-relaxed">{r.rewritten}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cover letter section */}
      <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
        <h2 className="text-sm font-medium">Cover letter</h2>
        <button
          onClick={generateCoverLetter}
          disabled={loadingLetter}
          className="bg-neutral-900 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {loadingLetter ? 'Drafting...' : coverLetter ? 'Regenerate' : 'Generate cover letter'}
        </button>
      </div>

      {loadingLetter && (
        <div className="bg-white border border-neutral-200 rounded-lg p-6 animate-pulse">
          <div className="space-y-3">
            <div className="h-3 bg-neutral-200 rounded w-3/4" />
            <div className="h-3 bg-neutral-200 rounded w-full" />
            <div className="h-3 bg-neutral-200 rounded w-5/6" />
            <div className="h-3 bg-neutral-100 rounded w-0" />
            <div className="h-3 bg-neutral-200 rounded w-full" />
            <div className="h-3 bg-neutral-200 rounded w-2/3" />
          </div>
          <p className="text-xs text-neutral-500 animate-pulse mt-4">
            Drafting cover letter — takes 30-60 seconds...
          </p>
        </div>
      )}

      {coverLetter && !loadingLetter && (
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <div className="flex justify-end gap-2 mb-4">
            <button
              onClick={copyToClipboard}
              className="text-xs px-3 py-1.5 border border-neutral-300 rounded hover:border-neutral-400"
            >
              {copied ? '✓ Copied' : 'Copy to clipboard'}
            </button>
          </div>
          <div className="prose prose-sm max-w-none">
            {coverLetter.split('\n').map((line, i) => (
              <p key={i} className={`text-sm leading-relaxed ${line.trim() === '' ? 'h-4' : ''}`}>
                {line}
              </p>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}