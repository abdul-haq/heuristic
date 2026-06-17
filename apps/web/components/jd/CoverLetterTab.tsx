'use client';

interface CoverLetterTabProps {
  coverLetter: string | null;
  loading: boolean;
  onGenerate: () => void;
  language?: string | null;
  copied: boolean;
  onCopy: () => void;
}

export function CoverLetterTab({
  coverLetter,
  loading,
  onGenerate,
  language,
  copied,
  onCopy,
}: CoverLetterTabProps) {
  const isGerman = language === 'de';

  if (!coverLetter && !loading) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-400 text-sm mb-4">
          Generate a {isGerman ? 'German' : 'English'} cover letter for this
          application
        </p>

        <button
          onClick={onGenerate}
          className="bg-neutral-900 text-white rounded-xl px-6 py-3 text-sm font-medium hover:bg-neutral-800 transition-colors"
        >
          Draft cover letter ({isGerman ? 'DE' : 'EN'})
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <div className="space-y-3 animate-pulse">
          <div className="h-3 bg-neutral-200 rounded w-1/3" />
          <div className="h-3 bg-neutral-100 rounded w-0 mt-4" />
          <div className="h-3 bg-neutral-200 rounded w-full" />
          <div className="h-3 bg-neutral-200 rounded w-5/6" />
          <div className="h-3 bg-neutral-200 rounded w-3/4" />
          <div className="h-3 bg-neutral-100 rounded w-0 mt-2" />
          <div className="h-3 bg-neutral-200 rounded w-full" />
          <div className="h-3 bg-neutral-200 rounded w-2/3" />
        </div>

        <p className="text-xs text-neutral-400 animate-pulse mt-6">
          Drafting cover letter — takes 30-60 seconds...
        </p>
      </div>
    );
  }

  if (!coverLetter) return null;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs text-neutral-400">
          {isGerman ? 'German cover letter' : 'English cover letter'}
        </p>

        <div className="flex gap-2">
          <button
            onClick={onGenerate}
            className="text-xs px-3 py-1.5 border border-neutral-200 rounded-lg text-neutral-500 hover:text-neutral-700"
          >
            Regenerate
          </button>

          <button
            onClick={onCopy}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-900 text-white hover:bg-neutral-800'
            }`}
          >
            {copied ? '✓ Copied' : 'Copy to clipboard'}
          </button>
        </div>
      </div>

      <div className="space-y-4 text-sm leading-relaxed text-neutral-700">
        {coverLetter.split('\n').map((line, i) =>
          line.trim() === '' ? (
            <div key={i} className="h-2" />
          ) : (
            <p key={i}>{line}</p>
          )
        )}
      </div>
    </div>
  );
}