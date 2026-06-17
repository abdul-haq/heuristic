'use client';

import { RewriteCard } from './RewriteCard';

interface Rewrite {
  bulletId: string;
  company?: string | null;
  original: string;
  rewritten: string;
  distance: number;
}

interface RewritesTabProps {
  rewrites: Rewrite[] | null;
  loading: boolean;
  onGenerate: () => void;
  accepted: Record<string, boolean>;
  acceptedCount: number;
  onToggleAccept: (bulletId: string) => void;
}

export function RewritesTab({
  rewrites,
  loading,
  onGenerate,
  accepted,
  acceptedCount,
  onToggleAccept,
}: RewritesTabProps) {
  if (!rewrites && !loading) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-400 text-sm mb-4">
          Generate tailored bullet suggestions for this JD
        </p>

        <button
          onClick={onGenerate}
          className="bg-neutral-900 text-white rounded-xl px-6 py-3 text-sm font-medium hover:bg-neutral-800 transition-colors"
        >
          Tailor CV bullets
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white border border-neutral-200 rounded-xl p-5 animate-pulse"
          >
            <div className="h-3 bg-neutral-100 rounded w-1/4 mb-4" />

            <div className="grid grid-cols-2 gap-6">
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

        <p className="text-xs text-neutral-400 animate-pulse text-center py-2">
          Rewriting bullets — takes 30-60 seconds...
        </p>
      </>
    );
  }

  if (!rewrites) return null;

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-400">
          {acceptedCount} of {rewrites.length} accepted
        </p>

        <button
          onClick={onGenerate}
          className="text-xs text-neutral-500 hover:text-neutral-700 px-3 py-1.5 border border-neutral-200 rounded-lg"
        >
          Regenerate
        </button>
      </div>

      {rewrites.map((rewrite) => (
        <RewriteCard
          key={rewrite.bulletId}
          company={rewrite.company ?? ''}
          original={rewrite.original}
          rewritten={rewrite.rewritten}
          distance={rewrite.distance}
          isAccepted={!!accepted[rewrite.bulletId]}
          onToggleAccept={() => onToggleAccept(rewrite.bulletId)}
        />
      ))}
    </>
  );
}