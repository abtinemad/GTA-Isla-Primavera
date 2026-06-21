/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Check } from 'lucide-react';
import logoUrl from '../assets/logo-gta-isla-primavera.png';
import { buildPhotoCollection } from '../utils/photoCollection';
import { savePosterComposition, loadPosterComposition } from '../utils/storage';

interface PosterComposerProps {
  onClose: () => void;
  coursePhotos: Record<string, string>;
  capturedPhotos: Record<number, string>;
  spotPhotos: Record<number, string>;
  freePhotos: Record<string, string>;
  gtaPhotos: Record<string, string>;
}

const SELECT_RING = '#00F5D4'; // même cyan que l'épingle sélectionnée

/**
 * Phase 5 — Compositeur de la jaquette finale (poster 9 cases). Noé arrange ses
 * photos (toute la collection, version GTA si dispo) dans un poster portrait façon
 * box art GTA (logo chromé à jour + 3×3). Tap pour placer / réorganiser / vider.
 * Persisté en IndexedDB. Pas d'export ici (Phase 6).
 */
export default function PosterComposer({
  onClose,
  coursePhotos,
  capturedPhotos,
  spotPhotos,
  freePhotos,
  gtaPhotos,
}: PosterComposerProps) {
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(9).fill(null));
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  // Charge la composition persistée une fois au montage.
  useEffect(() => {
    loadPosterComposition().then(setSlots).catch(() => {});
  }, []);

  const collection = useMemo(
    () => buildPhotoCollection(coursePhotos, capturedPhotos, spotPhotos, freePhotos),
    [coursePhotos, capturedPhotos, spotPhotos, freePhotos],
  );
  const originalByKey = useMemo(() => {
    const m = new Map<string, string>();
    collection.forEach((e) => m.set(e.key, e.original));
    return m;
  }, [collection]);

  // Affichage : version GTA si dispo, sinon l'original.
  const srcFor = (key: string): string | undefined => gtaPhotos[key] ?? originalByKey.get(key);

  const placedKeys = useMemo(() => new Set(slots.filter((s): s is string => !!s)), [slots]);

  const commit = (next: (string | null)[]) => {
    setSlots(next);
    void savePosterComposition(next);
  };

  // Tap sur une case : sélectionne ; si une autre case est déjà sélectionnée →
  // échange (réorganise) ; re-tap la même → désélectionne.
  const tapSlot = (i: number) => {
    if (selectedSlot === null) { setSelectedSlot(i); return; }
    if (selectedSlot === i) { setSelectedSlot(null); return; }
    const next = slots.slice();
    [next[selectedSlot], next[i]] = [next[i], next[selectedSlot]];
    commit(next);
    setSelectedSlot(null);
  };

  // Tap sur une photo de la réserve : la place dans la case sélectionnée (ou la
  // 1re case libre). Une photo ne peut occuper qu'une case (dédup).
  const tapReserve = (key: string) => {
    let target = selectedSlot;
    if (target === null) {
      target = slots.findIndex((s) => s === null);
      if (target === -1) return; // poster plein, aucune case sélectionnée
    }
    const next = slots.slice();
    for (let j = 0; j < next.length; j++) if (next[j] === key) next[j] = null;
    next[target] = key;
    commit(next);
    setSelectedSlot(null);
  };

  const emptySlot = (i: number) => {
    const next = slots.slice();
    next[i] = null;
    commit(next);
    if (selectedSlot === i) setSelectedSlot(null);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-[#0a0a0b] flex flex-col select-none">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="font-display font-black uppercase tracking-wide text-white text-sm">
          Composer ma jaquette
        </span>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="p-2 rounded-full border border-white/20 text-white/80 hover:text-white active:scale-95 cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {/* ── POSTER (box art portrait) ── */}
        <div
          className="mx-auto w-full max-w-[340px] rounded-2xl overflow-hidden border border-white/15"
          style={{ boxShadow: '0 0 0 1px rgba(255,255,255,.06), 0 20px 50px rgba(0,0,0,.6)' }}
        >
          <div
            className="px-5 pt-5 pb-3 flex flex-col items-center gap-2"
            style={{ background: 'radial-gradient(120% 80% at 50% 0%, #1a1326, #0a0a0b)' }}
          >
            <img
              src={logoUrl}
              alt="Grand Tenerife Auto · Isla Primavera"
              className="w-[82%] max-w-[250px] drop-shadow-[0_4px_14px_rgba(0,0,0,.6)]"
            />
            <span className="font-mono text-[8px] uppercase tracking-[3px] text-white/55">
              Ta jaquette · box art
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 p-3" style={{ background: '#0a0a0b' }}>
            {slots.map((key, i) => {
              const src = key ? srcFor(key) : undefined;
              const selected = selectedSlot === i;
              return (
                <button
                  key={i}
                  onClick={() => tapSlot(i)}
                  className={`relative aspect-square rounded-lg overflow-hidden border transition-all ${
                    selected
                      ? 'border-transparent ring-2'
                      : key
                        ? 'border-white/15'
                        : 'border-dashed border-white/20'
                  }`}
                  style={selected ? { boxShadow: `0 0 0 2px ${SELECT_RING}, 0 0 14px ${SELECT_RING}66` } : undefined}
                >
                  {src ? (
                    <>
                      <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      <button
                        onClick={(e) => { e.stopPropagation(); emptySlot(i); }}
                        aria-label="Vider la case"
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 border border-white/30 text-white flex items-center justify-center active:scale-95 cursor-pointer"
                      >
                        <X size={9} />
                      </button>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/[0.04]">
                      <Plus size={18} className="text-white/25" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RÉSERVE (toute la collection) ── */}
        <div className="mx-auto w-full max-w-[480px] mt-5">
          <div className="flex items-center justify-between px-0.5 mb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/60">
              Ta collection
            </span>
            {selectedSlot !== null && (
              <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: SELECT_RING }}>
                Touche une photo → case {selectedSlot + 1}
              </span>
            )}
          </div>

          {collection.length === 0 ? (
            <p className="text-white/40 text-xs leading-relaxed px-0.5">
              Pas encore de photos. Capture des clichés (runs, spots, perso) pour composer ta jaquette.
            </p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
              {collection.map((e) => {
                const placed = placedKeys.has(e.key);
                return (
                  <button
                    key={e.key}
                    onClick={() => tapReserve(e.key)}
                    className={`relative aspect-square rounded-lg overflow-hidden border ${
                      placed ? 'border-[#00F5D4]/60' : 'border-white/10'
                    } active:scale-95 cursor-pointer`}
                  >
                    <img
                      src={gtaPhotos[e.key] ?? e.original}
                      alt={e.label}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {placed && (
                      <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                        <Check size={14} style={{ color: SELECT_RING }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
