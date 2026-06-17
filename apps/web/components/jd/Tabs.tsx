'use client';

export type ActiveTab = 'rewrites' | 'letter';

interface TabsProps {
  activeTab: ActiveTab;
  onChange: (tab: ActiveTab) => void;
  rewritesLabel: string;
  letterLabel: string;
}

export function Tabs({
  activeTab,
  onChange,
  rewritesLabel,
  letterLabel,
}: TabsProps) {
  return (
    <div className="border-b border-neutral-200">
      <div className="flex gap-0">
        <button
          onClick={() => onChange('rewrites')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'rewrites'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-400 hover:text-neutral-600'
          }`}
        >
          {rewritesLabel}
        </button>

        <button
          onClick={() => onChange('letter')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'letter'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-400 hover:text-neutral-600'
          }`}
        >
          {letterLabel}
        </button>
      </div>
    </div>
  );
}