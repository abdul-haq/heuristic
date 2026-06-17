interface RewriteCardProps {
  company: string | null;
  original: string;
  rewritten: string;
  distance: number;
  isAccepted: boolean;
  onToggleAccept: () => void;
}

export function RewriteCard({
  company,
  original,
  rewritten,
  distance,
  isAccepted,
  onToggleAccept,
}: RewriteCardProps) {
  return (
    <div className={`bg-white border rounded-xl p-5 transition-colors ${
      isAccepted ? 'border-emerald-200 bg-emerald-50/30' : 'border-neutral-200'
    }`}>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">{company}</span>
          <span className="text-[10px] px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-md">
            {((1 - distance) * 100).toFixed(0)}% match
          </span>
        </div>
        <button
          onClick={onToggleAccept}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
            isAccepted
              ? 'bg-emerald-600 text-white'
              : 'border border-neutral-300 hover:border-emerald-400 hover:text-emerald-600'
          }`}
        >
          {isAccepted ? '✓ Accepted' : 'Accept'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-neutral-400 mb-2 font-medium">Original</p>
          <p className="text-sm text-neutral-500 leading-relaxed">{original}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-emerald-600 mb-2 font-medium">Tailored</p>
          <p className="text-sm leading-relaxed">{rewritten}</p>
        </div>
      </div>
    </div>
  );
}