/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FilterGroup, FILTER_GROUPS } from '../filterGroups';

interface MapFilterBarProps {
  activeGroups: FilterGroup[];
  onToggleGroup: (group: FilterGroup) => void;
  onSelectAll: () => void;
}

/**
 * Compact GTA-HUD legend overlaid on the map: one chip per filter group.
 * Tapping a chip shows/hides the matching markers (multi-select). The "Tous"
 * chip restores every group. Floating pill — never covers the map body, and it
 * respects the top safe-area inset + the global header height.
 */
export default function MapFilterBar({ activeGroups, onToggleGroup, onSelectAll }: MapFilterBarProps) {
  const allActive = activeGroups.length === FILTER_GROUPS.length;

  return (
    <div
      className="absolute left-0 right-0 z-[500] flex justify-center px-3 pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top) + 3.5rem)' }}
    >
      <div
        className="map-filter-scroll pointer-events-auto flex items-center gap-2 overflow-x-auto rounded-2xl border px-2 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.5)] max-w-full"
        style={{
          background: 'color-mix(in srgb, var(--surface) 80%, transparent)',
          borderColor: 'var(--hairline)',
          backdropFilter: 'blur(14px) saturate(1.25)',
          WebkitBackdropFilter: 'blur(14px) saturate(1.25)',
          scrollbarWidth: 'none',
        }}
      >
        {/* Reset: show everything */}
        <button
          onClick={onSelectAll}
          aria-pressed={allActive}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full border font-display text-[11px] uppercase font-bold tracking-wide whitespace-nowrap cursor-pointer transition-all duration-200 active:scale-95"
          style={{
            backgroundColor: allActive ? '#EFF0F2' : undefined,
            color: allActive ? '#090d16' : '#cbd5e1',
            borderColor: allActive ? '#EFF0F2' : 'rgba(148,163,184,0.35)',
            boxShadow: allActive ? '0 0 12px #EFF0F2a0' : undefined,
            opacity: allActive ? 1 : 0.85,
          }}
        >
          <span className="text-[12px]">🗺️</span>
          <span>Tous</span>
        </button>

        {FILTER_GROUPS.map((g) => {
          const isActive = activeGroups.includes(g.id);
          return (
            <button
              key={g.id}
              onClick={() => onToggleGroup(g.id)}
              aria-pressed={isActive}
              title={`${isActive ? 'Masquer' : 'Afficher'} ${g.label}`}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full border font-display text-[11px] uppercase font-bold tracking-wide whitespace-nowrap cursor-pointer transition-all duration-200 active:scale-95"
              style={{
                backgroundColor: isActive ? g.color : 'rgba(15,23,42,0.55)',
                color: isActive ? '#090d16' : '#94a3b8',
                borderColor: isActive ? g.color : 'rgba(148,163,184,0.28)',
                boxShadow: isActive ? `0 0 12px ${g.color}99` : undefined,
                opacity: isActive ? 1 : 0.55,
              }}
            >
              <span className="text-[12px]" style={{ filter: isActive ? 'none' : 'grayscale(0.6)' }}>
                {g.emoji}
              </span>
              <span>{g.label}</span>
            </button>
          );
        })}
      </div>

      <style>{`
        .map-filter-scroll::-webkit-scrollbar { display: none !important; }
      `}</style>
    </div>
  );
}
