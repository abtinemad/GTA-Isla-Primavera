/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { LocationItem } from '../types';
import { CATEGORY_MAP } from '../utils/helper';
import { FilterGroup, isCategoryVisible } from '../filterGroups';
import { Compass, Info, Trophy, MapPin } from 'lucide-react';

// Maps each category to its design-token accent (see src/styles/tokens.css)
// used for the left "liseré" rail on every spot card.
const CATEGORY_RAIL: Record<string, string> = {
  // QG token is near-white (--cat-qg #EDEFF2); use a readable neutral on light cards.
  QG: '#9A9CA4',
  Ravitaillement: 'var(--cat-ravito)',
  Bars: 'var(--cat-bars)',
  Missions: 'var(--cat-missions)',
  Escapades: 'var(--cat-escapades)',
  Plages: 'var(--cat-plages)',
  Restaurants: 'var(--cat-restaurants)',
};

interface LocationsListProps {
  locations: LocationItem[];
  selectedLocation: LocationItem | null;
  activeGroups: FilterGroup[];
  onSelectLocation: (location: LocationItem) => void;
  userCoords?: { lat: number; lng: number } | null;
}

export default function LocationsList({
  locations,
  selectedLocation,
  activeGroups,
  onSelectLocation,
  userCoords
}: LocationsListProps) {
  const [showCanaryStats, setShowCanaryStats] = useState(true);

  // Trophy entries (category "🏆 Trophées - …", id 101-105) duplicate the
  // coordinates of a physical spot and only exist as fly-to targets for the
  // "Trophées Disponibles" panel below — they must not appear as spot cards.
  const physicalLocations = useMemo(
    () => locations.filter((loc) => !loc.category.startsWith('🏆')),
    [locations]
  );

  // Filter locations based on the active filter groups (shared source of truth)
  const filteredLocations = useMemo(() => {
    return physicalLocations.filter((loc) => isCategoryVisible(loc.category, activeGroups));
  }, [physicalLocations, activeGroups]);

  // Calculate distance if available
  const getDistance = (lat: number, lng: number) => {
    if (!userCoords) return null;
    const R = 6371; // Earth's radius in km
    const dLat = ((lat - userCoords.lat) * Math.PI) / 180;
    const dLng = ((lng - userCoords.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userCoords.lat * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // in km
  };

  // Sort locations by nearest if user coords are enabled
  const sortedLocations = useMemo(() => {
    if (!userCoords) return filteredLocations;
    return [...filteredLocations].sort((a, b) => {
      const distA = getDistance(a.lat, a.lng) ?? 999999;
      const distB = getDistance(b.lat, b.lng) ?? 999999;
      return distA - distB;
    });
  }, [filteredLocations, userCoords]);

  // Count categories
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    physicalLocations.forEach(l => {
      stats[l.category] = (stats[l.category] || 0) + 1;
    });
    return stats;
  }, [physicalLocations]);

  return (
    <div className="flex flex-col h-full bg-transparent border-r border-[color:var(--hairline)] overflow-hidden w-full">
      
      {/* Search Header (Hidden on mobile to avoid duplication and clutter beneath the global glassmorphic header) */}
      <div className="hidden md:flex p-4 border-b border-zinc-200 bg-white/95 backdrop-blur-md flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass size={18} className="text-zinc-600 rotate-12" />
            <h2 className="font-display font-extrabold text-lg text-zinc-950 tracking-tight">Points d'intérêt</h2>
          </div>
          <span className="text-xs bg-zinc-100 border border-zinc-220 text-zinc-700 font-mono px-2 py-0.5 rounded-md shadow-inner">
            {filteredLocations.length} / {physicalLocations.length}
          </span>
        </div>

        {/* Canarian Islands Themed Telemetry Dashboard Block */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-550"></span>
                </span>
                <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-zinc-650">Canarian Telemetry</span>
              </div>
              <button 
                onClick={() => setShowCanaryStats(!showCanaryStats)}
                className="text-[10px] font-mono text-zinc-500 hover:text-zinc-800 underline cursor-pointer"
              >
                {showCanaryStats ? "Réduire" : "Afficher"}
              </button>
            </div>

            {showCanaryStats && (
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="bg-white border border-zinc-200/80 rounded-lg p-2 flex flex-col shadow-xs">
                  <span className="text-zinc-500 text-[9px] uppercase font-semibold">🌋 Sommet Teide</span>
                  <span className="text-zinc-800 font-semibold mt-0.5">3 715m · Stable</span>
                </div>
                <div className="bg-white border border-zinc-200/80 rounded-lg p-2 flex flex-col shadow-xs">
                  <span className="text-zinc-500 text-[9px] uppercase font-semibold">🌬️ Alizés (NNE)</span>
                  <span className="text-zinc-800 font-semibold mt-0.5">18 km/h · Sec</span>
                </div>
                <div className="bg-white border border-zinc-200/80 rounded-lg p-2 flex flex-col shadow-xs">
                  <span className="text-zinc-500 text-[9px] uppercase font-semibold">🌡️ Température</span>
                  <span className="text-zinc-800 font-semibold mt-0.5">24.5 °C · Idéal</span>
                </div>
                <div className="bg-white border border-zinc-200/80 rounded-lg p-2 flex flex-col shadow-xs">
                  <span className="text-zinc-500 text-[9px] uppercase font-semibold">🌴 Zone</span>
                  <span className="text-zinc-800 font-semibold mt-0.5">Archipel Adeje</span>
                </div>
              </div>
            )}
            
            {/* Canarian Flag Colored Accents Band */}
            <div className="mt-2.5 h-1 w-full rounded-full overflow-hidden flex">
              <div className="h-full w-1/3 bg-white" title="Canary Islands: Blanco" />
              <div className="h-full w-1/3 bg-sky-600" title="Canary Islands: Azul" />
              <div className="h-full w-1/3 bg-amber-500" title="Canary Islands: Amarillo" />
            </div>
          </div>
        </div>

        {/* Available Trophies block */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3 flex flex-col gap-2 shadow-xs">
          <div className="flex items-center gap-1.5 justify-between">
            <div className="flex items-center gap-1.5">
              <Trophy size={13} className="text-amber-600 animate-pulse shrink-0" />
              <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-zinc-650">Trophées Disponibles</span>
            </div>
            <span className="text-[9px] font-mono text-zinc-500 font-semibold select-none font-sans">Cliquer pour cibler</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-1.5 max-h-[148px] overflow-y-auto no-scrollbar">
            {[
              {
                name: 'Au-dessus des Nuages',
                emoji: '☁️',
                desc: 'Mission Volcan · TF-21',
                targetId: 102
              },
              {
                name: 'Roi de la Gomme',
                emoji: '🏎️',
                desc: 'Mission Teno · TF-436',
                targetId: 101
              },
              {
                name: 'Maître du Flow',
                emoji: '🌲',
                desc: 'Mission Anaga · TF-12',
                targetId: 9
              },
              {
                name: 'Chasseur de Fantômes',
                emoji: '👻',
                desc: 'Escapade Côte Est · Abades',
                targetId: 103
              },
              {
                name: 'Grand Tourer',
                emoji: '🏁',
                desc: 'Mission Côte Est · TF-1',
                targetId: 104
              },
              {
                name: 'Chasseur de Criques',
                emoji: '🐚',
                desc: 'Escapade Ouest · D. Hernández',
                targetId: 17
              },
              {
                name: 'Contraste Total',
                emoji: '🏝️',
                desc: 'Mission Nord-Est · Las Teresitas',
                targetId: 18
              },
              {
                name: 'Ravitaillement Complet',
                emoji: '🍻',
                desc: 'Life-Style · La Caleta',
                targetId: 105
              }
            ].map((trophy) => {
              const targetLoc = locations.find(l => l.id === trophy.targetId);
              const isTargeted = selectedLocation && (
                trophy.targetId === 104 
                  ? (selectedLocation.id === 104 || selectedLocation.id === 12 || selectedLocation.id === 13) 
                  : selectedLocation.id === trophy.targetId
              );

              return (
                <button
                  key={trophy.name}
                  onClick={() => {
                    if (targetLoc) onSelectLocation(targetLoc);
                  }}
                  className={`
                    w-full flex items-center justify-between text-left p-2 rounded-xl border transition-all duration-300 cursor-pointer group
                    ${isTargeted 
                      ? 'bg-amber-100 border-amber-300 text-amber-850 shadow-sm' 
                      : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-sm shrink-0 transition-transform duration-300 group-hover:scale-110 ${isTargeted ? 'animate-bounce' : ''}`}>
                      {trophy.emoji}
                    </span>
                    <div className="min-w-0 flex flex-col">
                      <span className="text-[11px] font-bold tracking-tight font-display text-zinc-900 truncate">
                        {trophy.name}
                      </span>
                      <span className="text-[9px] text-zinc-500 font-mono truncate">
                        {trophy.desc}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center shrink-0">
                    <Trophy size={11} className={isTargeted ? 'text-amber-600' : 'text-zinc-400 group-hover:text-zinc-600 transition-colors'} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Category Mini-stats (inline row) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-[10px] font-mono tracking-wider font-semibold uppercase text-zinc-500">
          <span className="shrink-0 mr-1 text-zinc-500">Total :</span>
          {Object.entries(CATEGORY_MAP).map(([key, value]) => {
            const count = categoryStats[key] || 0;
            if (count === 0) return null;
            return (
              <span key={key} className="shrink-0 flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-zinc-200 shadow-xs">
                <span>{value.emoji}</span>
                <span className="text-zinc-700 font-bold">{count}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Stats explanation text if looking at user's location */}
      {userCoords && (
        <div
          className="border-b border-[color:var(--hairline)] px-4 py-2 flex items-center gap-2 text-[11px] font-semibold text-[color:var(--text-muted)] shadow-sm"
          style={{
            background: 'color-mix(in srgb, var(--surface) 55%, transparent)',
            backdropFilter: 'blur(var(--blur-glass))',
            WebkitBackdropFilter: 'blur(var(--blur-glass))',
          }}
        >
          <Info size={12} className="shrink-0 opacity-70" />
          <span>Spots triés du plus proche au plus éloigné</span>
        </div>
      )}

      {/* Locations Cards List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {sortedLocations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--glass-bg)] backdrop-blur-md flex items-center justify-center mb-3 border border-[color:var(--hairline)] shadow-xs">
              <Compass size={20} className="text-[color:var(--text-muted)] animate-spin-slow" />
            </div>
            <p className="text-sm font-semibold text-[color:var(--text)]">Aucun spot trouvé</p>
            <p className="text-xs text-[color:var(--text-muted)] mt-1 max-w-[200px]">Modifiez vos caractéristiques de ciblage ou la recherche.</p>
          </div>
        ) : (
          sortedLocations.map((loc) => {
            const isSelected = selectedLocation?.id === loc.id;
            const cat = CATEGORY_MAP[loc.category] || CATEGORY_MAP.QG;
            const railColor = CATEGORY_RAIL[loc.category] || 'var(--cat-qg)';
            const dist = getDistance(loc.lat, loc.lng);

            return (
              <div
                key={loc.id}
                onClick={() => onSelectLocation(loc)}
                style={{
                  borderLeft: `var(--rail-accent) solid ${railColor}`,
                  // Verre transparent : ~55% de surface → la fresque Manrique
                  // transparaît, le flou (frosted) garde le texte lisible.
                  background: 'color-mix(in srgb, var(--surface) 55%, transparent)',
                  backdropFilter: 'blur(16px) saturate(1.3)',
                  WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
                }}
                className={`
                  relative p-3.5 rounded-2xl border text-left cursor-pointer flex flex-col gap-2 transition-all duration-200 shadow-sm
                  ${isSelected
                    ? 'border-amber-500 ring-2 ring-amber-500/20'
                    : 'border-[color:var(--hairline)] hover:brightness-105'
                  }
                `}
              >
                <div className="flex gap-2 items-start justify-between">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-1 font-bold uppercase tracking-wider shadow-xs ${cat.bgClass}`}>
                    <span>{cat.emoji}</span>
                    <span className="font-display">{cat.label}</span>
                  </span>

                  {dist != null && (
                    <span className="text-[10px] font-mono font-semibold text-[color:var(--text-muted)] bg-[color:var(--hairline)] px-1.5 py-0.5 rounded border border-[color:var(--hairline)] shrink-0">
                      {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
                    </span>
                  )}
                </div>

                {/* Name */}
                <h4 className="font-display font-extrabold text-sm text-[color:var(--text)] leading-snug">
                  {loc.name}
                </h4>

                {/* Snippet info */}
                <p className="text-xs text-[color:var(--text-muted)] font-sans line-clamp-2 leading-relaxed">
                  {loc.info}
                </p>

                {/* Control elements */}
                <div className="flex items-center justify-between pt-1.5 mt-0.5 border-t border-[color:var(--hairline)] text-[10px] font-mono text-[color:var(--text-muted)]">
                  <div className="flex items-center gap-1">
                    <MapPin size={9} />
                    <span>{loc.lat.toFixed(3)}, {loc.lng.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
