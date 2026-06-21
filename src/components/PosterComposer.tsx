/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { X, Plus, Check, Move } from 'lucide-react';
import logoUrl from '../assets/logo-gta-isla-primavera.png';
import { buildPhotoCollection } from '../utils/photoCollection';
import {
  savePosterComposition,
  loadPosterComposition,
  DEFAULT_POSTER_LOGO,
  type PosterLogo,
} from '../utils/storage';

interface PosterComposerProps {
  onClose: () => void;
  coursePhotos: Record<string, string>;
  capturedPhotos: Record<number, string>;
  spotPhotos: Record<number, string>;
  freePhotos: Record<string, string>;
  gtaPhotos: Record<string, string>;
}

const SELECT_RING = '#00F5D4'; // même cyan que l'épingle sélectionnée
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Phase 5 — Compositeur de la jaquette finale (poster 9 cases + LOGO LIBRE). Noé
 * arrange ses photos (toute la collection, version GTA si dispo) dans un poster
 * portrait façon box art GTA, et place/redimensionne le logo elle-même. Tout est
 * persisté en IndexedDB. Pas d'export ici (Phase 6).
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
  const [logo, setLogo] = useState<PosterLogo>(DEFAULT_POSTER_LOGO);
  const [logoEdit, setLogoEdit] = useState(false);

  const posterRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; bx: number; by: number; rect: DOMRect } | null>(null);
  const loadedRef = useRef(false);

  // Charge la composition persistée (photos + logo) une fois au montage.
  useEffect(() => {
    loadPosterComposition()
      .then((c) => { setSlots(c.slots); setLogo(c.logo); })
      .catch(() => {})
      .finally(() => { loadedRef.current = true; });
  }, []);

  // Sauvegarde debouncée (évite le spam d'écritures pendant le drag du logo).
  useEffect(() => {
    if (!loadedRef.current) return;
    const t = setTimeout(() => void savePosterComposition({ slots, logo }), 350);
    return () => clearTimeout(t);
  }, [slots, logo]);

  const collection = useMemo(
    () => buildPhotoCollection(coursePhotos, capturedPhotos, spotPhotos, freePhotos),
    [coursePhotos, capturedPhotos, spotPhotos, freePhotos],
  );
  const originalByKey = useMemo(() => {
    const m = new Map<string, string>();
    collection.forEach((e) => m.set(e.key, e.original));
    return m;
  }, [collection]);
  const srcFor = (key: string): string | undefined => gtaPhotos[key] ?? originalByKey.get(key);
  const placedKeys = useMemo(() => new Set(slots.filter((s): s is string => !!s)), [slots]);

  // ── Photos ────────────────────────────────────────────────────────────────
  const tapSlot = (i: number) => {
    if (logoEdit) return; // mode logo : cases inertes
    if (selectedSlot === null) { setSelectedSlot(i); return; }
    if (selectedSlot === i) { setSelectedSlot(null); return; }
    setSlots((prev) => {
      const next = prev.slice();
      [next[selectedSlot], next[i]] = [next[i], next[selectedSlot]];
      return next;
    });
    setSelectedSlot(null);
  };
  const tapReserve = (key: string) => {
    let target = selectedSlot;
    if (target === null) {
      target = slots.findIndex((s) => s === null);
      if (target === -1) return;
    }
    const t = target;
    setSlots((prev) => {
      const next = prev.slice();
      for (let j = 0; j < next.length; j++) if (next[j] === key) next[j] = null;
      next[t] = key;
      return next;
    });
    setSelectedSlot(null);
  };
  const emptySlot = (i: number) => {
    setSlots((prev) => { const next = prev.slice(); next[i] = null; return next; });
    if (selectedSlot === i) setSelectedSlot(null);
  };

  // ── Logo : drag (pointer/touch, borné au poster) ────────────────────────────
  const onLogoPointerDown = (e: ReactPointerEvent) => {
    if (!logoEdit || !posterRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      sx: e.clientX, sy: e.clientY, bx: logo.x, by: logo.y,
      rect: posterRef.current.getBoundingClientRect(),
    };
  };
  const onLogoPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = clamp(d.bx + (e.clientX - d.sx) / d.rect.width, 0.08, 0.92);
    const ny = clamp(d.by + (e.clientY - d.sy) / d.rect.height, 0.08, 0.92);
    setLogo((l) => ({ ...l, x: nx, y: ny }));
  };
  const onLogoPointerUp = (e: ReactPointerEvent) => {
    if (dragRef.current) { e.currentTarget.releasePointerCapture?.(e.pointerId); dragRef.current = null; }
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
        {/* ── POSTER (box art portrait) : 9 photos + logo libre par-dessus ── */}
        <div
          ref={posterRef}
          className="relative mx-auto w-full max-w-[340px] aspect-[4/5] rounded-2xl overflow-hidden border border-white/15 bg-[#0a0a0b]"
          style={{ boxShadow: '0 0 0 1px rgba(255,255,255,.06), 0 20px 50px rgba(0,0,0,.6)' }}
        >
          {/* 9 cases (fond) */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-1.5 p-2">
            {slots.map((key, i) => {
              const src = key ? srcFor(key) : undefined;
              const selected = selectedSlot === i && !logoEdit;
              return (
                <button
                  key={i}
                  onClick={() => tapSlot(i)}
                  className={`relative rounded-lg overflow-hidden border transition-all ${
                    selected ? 'border-transparent' : src ? 'border-white/15' : 'border-dashed border-white/20'
                  }`}
                  style={selected ? { boxShadow: `0 0 0 2px ${SELECT_RING}, 0 0 14px ${SELECT_RING}66` } : undefined}
                >
                  {src ? (
                    <>
                      <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      {!logoEdit && (
                        <button
                          onClick={(e) => { e.stopPropagation(); emptySlot(i); }}
                          aria-label="Vider la case"
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 border border-white/30 text-white flex items-center justify-center active:scale-95 cursor-pointer"
                        >
                          <X size={9} />
                        </button>
                      )}
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

          {/* Logo libre (calque au-dessus) — draggable seulement en mode logo */}
          <div
            onPointerDown={onLogoPointerDown}
            onPointerMove={onLogoPointerMove}
            onPointerUp={onLogoPointerUp}
            className="absolute"
            style={{
              left: `${logo.x * 100}%`,
              top: `${logo.y * 100}%`,
              width: `${logo.w * 100}%`,
              transform: 'translate(-50%, -50%)',
              touchAction: 'none',
              cursor: logoEdit ? 'grab' : 'default',
              pointerEvents: logoEdit ? 'auto' : 'none',
              outline: logoEdit ? `1.5px dashed ${SELECT_RING}` : 'none',
              outlineOffset: '4px',
              borderRadius: '6px',
            }}
          >
            {/* Scrim sombre derrière le logo → lisible même sur une photo claire */}
            <div
              className="absolute"
              style={{
                inset: '-14% -10%',
                background: 'radial-gradient(closest-side, rgba(0,0,0,.55), transparent 75%)',
                filter: 'blur(6px)',
              }}
            />
            <img
              src={logoUrl}
              alt="Grand Tenerife Auto · Isla Primavera"
              draggable={false}
              className="relative w-full select-none pointer-events-none drop-shadow-[0_3px_10px_rgba(0,0,0,.7)]"
            />
          </div>
        </div>

        {/* ── Barre logo : déplacer + taille ── */}
        <div className="mx-auto w-full max-w-[340px] mt-3 flex items-center gap-3">
          <button
            onClick={() => { setLogoEdit((v) => !v); setSelectedSlot(null); }}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all active:scale-95 cursor-pointer border ${
              logoEdit ? 'bg-[#00F5D4] text-[#062b27] border-transparent' : 'bg-white/5 text-white/80 border-white/20'
            }`}
          >
            <Move size={14} />
            {logoEdit ? 'Logo : OK' : 'Déplacer le logo'}
          </button>
          {logoEdit && (
            <label className="flex-1 flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-wider text-white/50">Taille</span>
              <input
                type="range"
                min={0.3}
                max={1.05}
                step={0.01}
                value={logo.w}
                onChange={(e) => setLogo((l) => ({ ...l, w: parseFloat(e.target.value) }))}
                className="flex-1 accent-[#00F5D4]"
              />
            </label>
          )}
        </div>

        {/* ── RÉSERVE (toute la collection) ── */}
        <div className="mx-auto w-full max-w-[480px] mt-5">
          <div className="flex items-center justify-between px-0.5 mb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/60">Ta collection</span>
            {!logoEdit && selectedSlot !== null && (
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
