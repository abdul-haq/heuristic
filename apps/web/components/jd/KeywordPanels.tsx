interface Analysis {
  matchScore: number;
  semanticScore: number;
  keywordScore: number;
  matched: {
    mustHaves: string[];
    niceToHaves: string[];
  };
  missing: {
    mustHaves: string[];
  };
  redFlags: string[];
}

interface KeywordPanelsProps {
  loadingAnalysis: boolean;
  analysis: Analysis | null;
}

export function KeywordPanels({
  loadingAnalysis,
  analysis,
}: KeywordPanelsProps) {
  if (loadingAnalysis) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-32 bg-neutral-100 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!analysis) return null;

  const hasMatchedKeywords =
    analysis.matched.mustHaves.length > 0 ||
    analysis.matched.niceToHaves.length > 0;

  return (
    <>
      {analysis.redFlags.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1.5">
          {analysis.redFlags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-red-500 text-sm">⚠</span>
              <p className="text-sm text-red-700">{flag}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-[11px] uppercase tracking-wide text-neutral-400 mb-3 font-medium">
            Keywords matched
          </p>

          <div className="flex flex-wrap gap-1.5">
            {analysis.matched.mustHaves.map((keyword) => (
              <span
                key={keyword}
                className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 rounded-md font-medium"
              >
                {keyword}
              </span>
            ))}

            {analysis.matched.niceToHaves.map((keyword) => (
              <span
                key={keyword}
                className="px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded-md"
              >
                {keyword}
              </span>
            ))}

            {!hasMatchedKeywords && (
              <span className="text-xs text-neutral-400">No matches</span>
            )}
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-[11px] uppercase tracking-wide text-neutral-400 mb-3 font-medium">
            Missing & flags
          </p>

          <div className="flex flex-wrap gap-1.5">
            {analysis.missing.mustHaves.map((keyword) => (
              <span
                key={keyword}
                className="px-2.5 py-1 text-xs bg-amber-50 text-amber-700 rounded-md"
              >
                {keyword}
              </span>
            ))}

            {analysis.missing.mustHaves.length === 0 && (
              <span className="text-xs text-emerald-600 font-medium">
                All covered ✓
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}