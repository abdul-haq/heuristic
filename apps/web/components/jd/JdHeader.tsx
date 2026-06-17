// components/jd/JdHeader.tsx

interface JD {
  roleTitle?: string | null;
  companyName?: string | null;
  location?: string | null;
  language?: string | null;
  germanLevel?: string | null;
  workFormat?: string | null;
}

interface Analysis {
  matchScore: number;
}

interface JdHeaderProps {
  jd: JD;
  analysis: Analysis | null;
}

export function JdHeader({ jd, analysis }: JdHeaderProps) {
  const getWorkFormatClass = (workFormat?: string | null) => {
    if (workFormat === 'werkstudent') {
      return 'bg-emerald-50 text-emerald-700';
    }

    if (workFormat === 'fulltime') {
      return 'bg-red-50 text-red-600';
    }

    return 'bg-neutral-100 text-neutral-500';
  };

  const getMatchScoreClass = (score: number) => {
    if (score >= 75) return 'text-emerald-600';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6 flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold">
          {jd.roleTitle ?? 'Untitled role'}
        </h1>

        <p className="text-sm text-neutral-500 mt-1">
          {jd.companyName ?? 'Unknown'} · {jd.location ?? 'Not specified'}
        </p>

        <div className="flex gap-2 mt-3 flex-wrap">
          {jd.language && (
            <span className="px-2.5 py-1 text-[11px] uppercase tracking-wide bg-neutral-100 text-neutral-500 rounded-md font-medium">
              {jd.language}
            </span>
          )}

          {jd.germanLevel && jd.germanLevel !== 'none' && (
            <span className="px-2.5 py-1 text-[11px] uppercase tracking-wide bg-amber-50 text-amber-700 rounded-md font-medium">
              German {jd.germanLevel}
            </span>
          )}

          {jd.workFormat && (
            <span
              className={`px-2.5 py-1 text-[11px] uppercase tracking-wide rounded-md font-medium ${getWorkFormatClass(
                jd.workFormat
              )}`}
            >
              {jd.workFormat}
            </span>
          )}
        </div>
      </div>

      {analysis && (
        <div className="text-right pl-6">
          <p className="text-[11px] text-neutral-400 uppercase tracking-wide">
            Match
          </p>

          <p
            className={`text-4xl font-bold ${getMatchScoreClass(
              analysis.matchScore
            )}`}
          >
            {analysis.matchScore}
          </p>
        </div>
      )}
    </div>
  );
}