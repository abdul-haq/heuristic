interface Version {
  id: string;
  createdAt: string;
}

interface VersionSwitcherProps {
  versions: Version[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function VersionSwitcher({ versions, activeId, onSelect }: VersionSwitcherProps) {
  if (versions.length <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-neutral-400 mr-1">History:</span>
      {versions.map((v, i) => {
        const label = `v${versions.length - i}`;
        const isActive = v.id === activeId;
        const date = new Date(v.createdAt);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            title={`Generated at ${timeStr}`}
            className={`px-2 py-0.5 text-[11px] rounded-md font-medium transition-colors ${
              isActive
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}