/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef } from 'react';
import { Category } from '../types';
import { CATEGORY_MAP } from '../utils/helper';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface QuickFilterBarProps {
  selectedCategory: Category | 'Tous';
  onSelectCategory: (category: Category | 'Tous') => void;
}

export default function QuickFilterBar({
  selectedCategory,
  onSelectCategory,
}: QuickFilterBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const filters: { value: Category | 'Tous'; label: string; emoji: string; color: string }[] = [
    { value: 'Tous', label: 'Tous', emoji: '🗺️', color: '#38bdf8' }, // sky-400
    { value: 'QG', label: 'QG', emoji: CATEGORY_MAP.QG.emoji, color: CATEGORY_MAP.QG.accentColor },
    { value: 'Ravitaillement', label: 'Ravitaillement', emoji: CATEGORY_MAP.Ravitaillement.emoji, color: CATEGORY_MAP.Ravitaillement.accentColor },
    { value: 'Bars', label: 'Bars', emoji: CATEGORY_MAP.Bars.emoji, color: CATEGORY_MAP.Bars.accentColor },
    { value: 'Missions', label: 'Missions', emoji: CATEGORY_MAP.Missions.emoji, color: CATEGORY_MAP.Missions.accentColor },
    { value: 'Escapades', label: 'Escapades', emoji: CATEGORY_MAP.Escapades.emoji, color: CATEGORY_MAP.Escapades.accentColor },
    { value: 'Plages', label: 'Plages', emoji: CATEGORY_MAP.Plages.emoji, color: CATEGORY_MAP.Plages.accentColor },
    { value: 'Restaurants', label: 'Restaurants', emoji: CATEGORY_MAP.Restaurants.emoji, color: CATEGORY_MAP.Restaurants.accentColor },
  ];

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
          {filters.map((filter) => {
            const isActive = selectedCategory === filter.value;
            return (
              <button
                key={filter.value}
                onClick={() => onSelectCategory(filter.value)}
                className={`
                  flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border font-display text-[11.5px] tracking-tight whitespace-nowrap cursor-pointer transition-all duration-300 active:scale-95
                  ${isActive
                    ? 'font-black border-transparent scale-102 font-extrabold'
                    : 'bg-slate-800/50 text-slate-200 border-slate-700/50 hover:bg-slate-700/70 hover:text-white'
                  }
                `}
                style={{
                  backgroundColor: isActive ? filter.color : undefined,
                  color: isActive ? '#090d16' : undefined,
                  borderColor: isActive ? filter.color : undefined,
                  boxShadow: isActive ? `0 0 14px ${filter.color}a0` : undefined,
                  textShadow: isActive ? 'none' : '0 1px 2.5px rgba(0,0,0,0.95)'
                }}
              >
                <span className="text-[12px]">{filter.emoji}</span>
                <span className="uppercase font-bold tracking-wide">{filter.label}</span>
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
