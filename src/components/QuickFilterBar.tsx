/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef } from 'react';
import { FilterGroup, FILTER_GROUPS } from '../filterGroups';
import { ChevronLeft, ChevronRight, Map as MapIcon } from 'lucide-react';

interface QuickFilterBarProps {
  activeGroups: FilterGroup[];
  onToggleGroup: (group: FilterGroup) => void;
  onSelectAll: () => void;
}

/**
 * Spot-view filter bar. Multi-select chips sharing the same source of truth as
 * the map overlay (see `src/filterGroups.ts`): toggling a chip shows/hides the
 * matching spots in the list and the matching markers on the map.
 */
export default function QuickFilterBar({
  activeGroups,
  onToggleGroup,
  onSelectAll,
}: QuickFilterBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const allActive = activeGroups.length === FILTER_GROUPS.length;

  const handleScroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const scrollAmount = 180;
      containerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="relative w-full bg-transparent px-4 py-1.5 pb-2">
      <div className="mx-auto max-w-7xl flex items-center justify-between">
        {/* Scroll Left Button */}
        <button
          onClick={() => handleScroll('left')}
          className="hidden md:flex p-1.5 rounded-full border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 shadow-lg transition-all cursor-pointer mr-2"
          aria-label="Filter gauche"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Scrollable container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-x-auto select-none no-scrollbar flex gap-2.5 items-center scroll-smooth pr-6 md:pr-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Reset: show everything */}
          <button
            onClick={onSelectAll}
            aria-pressed={allActive}
            className={`
              flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border font-display text-[11.5px] tracking-tight whitespace-nowrap cursor-pointer transition-all duration-300 active:scale-95
              ${allActive
                ? 'font-black border-transparent scale-102 font-extrabold'
                : 'bg-slate-800/50 text-slate-200 border-slate-700/50 hover:bg-slate-700/70 hover:text-white'
              }
            `}
            style={{
              backgroundColor: allActive ? '#EFF0F2' : undefined,
              color: allActive ? '#090d16' : undefined,
              borderColor: allActive ? '#EFF0F2' : undefined,
              boxShadow: allActive ? '0 0 14px #EFF0F2a0' : undefined,
              textShadow: allActive ? 'none' : '0 1px 2.5px rgba(0,0,0,0.95)',
            }}
          >
            <MapIcon size={14} />
            <span className="uppercase font-bold tracking-wide">Tous</span>
          </button>

          {FILTER_GROUPS.map((g) => {
            const isActive = activeGroups.includes(g.id);
            const Icon = g.icon;
            return (
              <button
                key={g.id}
                onClick={() => onToggleGroup(g.id)}
                aria-pressed={isActive}
                title={`${isActive ? 'Masquer' : 'Afficher'} ${g.label}`}
                className={`
                  flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border font-display text-[11.5px] tracking-tight whitespace-nowrap cursor-pointer transition-all duration-300 active:scale-95
                  ${isActive
                    ? 'font-black border-transparent scale-102 font-extrabold'
                    : 'bg-slate-800/50 text-slate-300 border-slate-700/50 hover:bg-slate-700/70 hover:text-white'
                  }
                `}
                style={{
                  backgroundColor: isActive ? g.color : undefined,
                  color: isActive ? '#090d16' : undefined,
                  borderColor: isActive ? g.color : undefined,
                  boxShadow: isActive ? `0 0 14px ${g.color}a0` : undefined,
                  textShadow: isActive ? 'none' : '0 1px 2.5px rgba(0,0,0,0.95)',
                  opacity: isActive ? 1 : 0.7,
                }}
              >
                <Icon size={14} />
                <span className="uppercase font-bold tracking-wide">{g.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scroll Right Button */}
        <button
          onClick={() => handleScroll('right')}
          className="hidden md:flex p-1.5 rounded-full border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 shadow-lg transition-all cursor-pointer ml-2"
          aria-label="Filter droite"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <style>{`
        /* Hide scrollbars but keep functionality */
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
