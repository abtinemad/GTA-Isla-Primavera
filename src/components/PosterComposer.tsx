/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type SyntheticEvent } from 'react';
import { X, Plus, Check, Move, Share2, Loader2, Trash2 } from 'lucide-react';
import logoUrl from '../assets/logo-gta-isla-primavera.png';
import { buildPhotoCollection } from '../utils/photoCollection';
import {
  savePosterComposition,
  loadPosterComposition,
  emptyPosterSlots,
  DEFAULT_POSTER_LOGO,
  DEFAULT_GUTTER,
  type PosterLogo,
  type PosterSlot,
} from '../utils/storage';
import { cellRects, caseAspectOf, placePhoto, clamp } from '../utils/posterGeometry';

interface PosterComposerProps {
  onClose: () => void;
  coursePhotos: Record<string, string>;
  capturedPhotos: Record<number, string>;
  spotPhotos: Record<number, string>;
  freePhotos: Record<string, string>;
  gtaPhotos: Record<string, string>;
}

const SELECT_RING = '#FF7A4E'; // surbrillance / sélection — primaire vif (charte)
const BRAND = '#EA4423';       // primaire plein — boutons (charte)
const POSTER_BG = '#0A0A0D';   // fond + filets noirs

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const EXPORT_FILENAME = 'grand-tenerife-auto-isla-primavera.jpg';
const CANVAS_W = 1440;
const CANVAS_H = 1800;

export default function PosterComposer({
  onClose,
  coursePhotos,
  capturedPhotos,
  spotPhotos,
  freePhotos,
  gtaPhotos,
}: PosterComposerProps) {
  const [slots, setSlots] = useState<PosterSlot[]>(() => emptyPosterSlots());
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [logo, setLogo] = useState<PosterLogo>(DEFAULT_POSTER_LOGO);
  const [gutter, setGutter] = useState(DEFAULT_GUTTER);
  const [logoEdit, setLogoEdit] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [ratios, setRatios] = useState<Record<string, number>>({});

  // Géométrie des cases dérivée du gutter (SOURCE UNIQUE) — écran + export identiques.
  const rects = useMemo(() => cellRects(gutter), [gutter]);
  const aspects = useMemo(() => rects.map(caseAspectOf), [rects]);

  const posterRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  // Drag d'une case (pan de la photo) + détection tap.
  const panRef = useRef<
    { i: number; sx: number; sy: number; bOX: number; bOY: number; mPX: number; mPY: number; moved: boolean; filled: boolean } | null
  >(null);
  // Drag du logo.
  const logoDragRef = useRef<{ sx: number; sy: number; bx: number; by: number; rect: DOMRect } | null>(null);

  // Charge la composition persistée (cases + logo + gutter) une fois au montage.
  useEffect(() => {
    loadPosterComposition()
      .then((c) => { setSlots(c.slots); setLogo(c.logo); setGutter(c.gutter); })
      .catch(() => {})
      .finally(() => { loadedRef.current = true; });
  }, []);

  // Sauvegarde debouncée (évite le spam pendant pan/zoom/drag).
  useEffect(() => {
    if (!loadedRef.current) return;
    const t = setTimeout(() => void savePosterComposition({ slots, logo, gutter }), 350);
    return () => clearTimeout(t);
  }, [slots, logo, gutter]);

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
  const placedKeys = useMemo(
    () => new Set(slots.map((s) => s.photoId).filter((id): id is string => !!id)),
    [slots],
  );

  const onImgLoad = (key: string, e: SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.naturalWidth > 0 && ratios[key] === undefined) {
      setRatios((r) => ({ ...r, [key]: el.naturalHeight / el.naturalWidth }));
    }
  };

  // ── Cases : pan (drag) + tap (sélection/échange) ────────────────────────────
  const onCasePointerDown = (i: number, e: ReactPointerEvent) => {
    if (logoEdit || !posterRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const slot = slots[i];
    const rect = posterRef.current.getBoundingClientRect();
    let mPX = 0, mPY = 0;
    if (slot.photoId) {
      const r = rects[i];
      const cellWpx = r.width * rect.width;
      const cellHpx = r.height * rect.height;
      const ratio = ratios[slot.photoId] ?? 1 / aspects[i];
      const g = placePhoto(aspects[i], ratio, slot.transform.scale, slot.transform.offsetX, slot.transform.offsetY);
      mPX = (cellWpx * g.overW) / 100 / 2;
      mPY = (cellHpx * g.overH) / 100 / 2;
    }
    panRef.current = {
      i, sx: e.clientX, sy: e.clientY,
      bOX: slot.transform.offsetX, bOY: slot.transform.offsetY,
      mPX, mPY, moved: false, filled: !!slot.photoId,
    };
  };
  const onCasePointerMove = (e: ReactPointerEvent) => {
    const p = panRef.current;
    if (!p) return;
    const dx = e.clientX - p.sx;
    const dy = e.clientY - p.sy;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) p.moved = true;
    if (p.filled && p.moved) {
      const nox = p.mPX > 0 ? clamp(p.bOX + dx / p.mPX, -1, 1) : p.bOX;
      const noy = p.mPY > 0 ? clamp(p.bOY + dy / p.mPY, -1, 1) : p.bOY;
      setSlots((prev) => prev.map((s, idx) =>
        idx === p.i ? { ...s, transform: { ...s.transform, offsetX: nox, offsetY: noy } } : s));
    }
  };
  const onCasePointerUp = (i: number, e: ReactPointerEvent) => {
    const p = panRef.current;
    if (!p) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    panRef.current = null;
    if (!p.moved) tapCase(i);
  };
  const tapCase = (i: number) => {
    if (selectedSlot === null) { setSelectedSlot(i); return; }
    if (selectedSlot === i) { setSelectedSlot(null); return; }
    const a = selectedSlot;
    setSlots((prev) => { const next = prev.slice(); [next[a], next[i]] = [next[i], next[a]]; return next; });
    setSelectedSlot(null);
  };

  const tapReserve = (key: string) => {
    let target = selectedSlot;
    if (target === null) {
      target = slots.findIndex((s) => !s.photoId);
      if (target === -1) return;
    }
    const t = target;
    setSlots((prev) => {
      const next = prev.map((s) => (s.photoId === key ? { ...s, photoId: null } : s));
      next[t] = { photoId: key, transform: { scale: 1, offsetX: 0, offsetY: 0 } };
      return next;
    });
    setSelectedSlot(null);
  };
  const emptySlot = (i: number) => {
    setSlots((prev) => { const next = prev.slice(); next[i] = { photoId: null, transform: { scale: 1, offsetX: 0, offsetY: 0 } }; return next; });
    if (selectedSlot === i) setSelectedSlot(null);
  };
  const setSlotScale = (i: number, scale: number) => {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, transform: { ...s.transform, scale } } : s)));
  };

  // ── Logo : drag ─────────────────────────────────────────────────────────────
  const onLogoPointerDown = (e: ReactPointerEvent) => {
    if (!logoEdit || !posterRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    logoDragRef.current = { sx: e.clientX, sy: e.clientY, bx: logo.x, by: logo.y, rect: posterRef.current.getBoundingClientRect() };
  };
  const onLogoPointerMove = (e: ReactPointerEvent) => {
    const d = logoDragRef.current;
    if (!d) return;
    const nx = clamp(d.bx + (e.clientX - d.sx) / d.rect.width, 0.08, 0.92);
    const ny = clamp(d.by + (e.clientY - d.sy) / d.rect.height, 0.08, 0.92);
    setLogo((l) => ({ ...l, x: nx, y: ny }));
  };
  const onLogoPointerUp = (e: ReactPointerEvent) => {
    if (logoDragRef.current) { e.currentTarget.releasePointerCapture?.(e.pointerId); logoDragRef.current = null; }
  };

  // ── Export Canvas (WYSIWYG) ─────────────────────────────────────────────────
  const exportPoster = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = POSTER_BG;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const imgs = await Promise.all(
        slots.map(async (s) => {
          if (!s.photoId) return null;
          const src = srcFor(s.photoId);
          if (!src) return null;
          try { return await loadImage(src); } catch { return null; }
        }),
      );

      for (let i = 0; i < 9; i++) {
        const r = rects[i];
        const cx = r.left * CANVAS_W, cy = r.top * CANVAS_H;
        const cw = r.width * CANVAS_W, ch = r.height * CANVAS_H;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx, cy, cw, ch);
        ctx.clip();
        const img = imgs[i];
        const slot = slots[i];
        if (img && img.naturalWidth > 0 && slot.photoId) {
          const ratio = img.naturalHeight / img.naturalWidth;
          const g = placePhoto(aspects[i], ratio, slot.transform.scale, slot.transform.offsetX, slot.transform.offsetY);
          const dw = (g.drawWpct / 100) * cw;
          const dh = (g.drawHpct / 100) * ch;
          const dx = cx + (g.leftPct / 100) * cw;
          const dy = cy + (g.topPct / 100) * ch;
          ctx.drawImage(img, dx, dy, dw, dh);
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(cx, cy, cw, ch);
        }
        ctx.restore();
      }

      try {
        const logoImg = await loadImage(logoUrl);
        const lw = logo.w * CANVAS_W;
        const lh = lw * (logoImg.naturalHeight / logoImg.naturalWidth);
        const lcx = logo.x * CANVAS_W, lcy = logo.y * CANVAS_H;
        const sW = lw * 1.2, sH = lh * 1.28;
        const scale = CANVAS_W / 340;
        ctx.save();
        ctx.filter = `blur(${Math.round(6 * scale)}px)`;
        const grad = ctx.createRadialGradient(lcx, lcy, 0, lcx, lcy, Math.max(sW, sH) / 2);
        grad.addColorStop(0, 'rgba(0,0,0,0.55)');
        grad.addColorStop(0.75, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(lcx - sW / 2, lcy - sH / 2, sW, sH);
        ctx.restore();
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 10 * scale;
        ctx.shadowOffsetY = 3 * scale;
        ctx.drawImage(logoImg, lcx - lw / 2, lcy - lh / 2, lw, lh);
        ctx.restore();
      } catch { /* sans logo */ }

      const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.92));
      if (!blob) return;
      const file = new File([blob], EXPORT_FILENAME, { type: 'image/jpeg' });
      const canShareFiles =
        typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
      if (typeof navigator !== 'undefined' && navigator.share && canShareFiles) {
        try {
          await navigator.share({ files: [file], title: 'Grand Tenerife Auto · Isla Primavera', text: 'Ma jaquette' });
          return;
        } catch { /* annulé → download */ }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = EXPORT_FILENAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } finally {
      setExporting(false);
    }
  };

  const selSlot = selectedSlot !== null ? slots[selectedSlot] : null;

  return (
    <div className="fixed inset-0 z-[10000] bg-[#0a0a0b] flex flex-col select-none">
      <style>{`
        .jq-range { -webkit-appearance:none; appearance:none; height:4px; border-radius:99px; background:rgba(255,255,255,.14); outline:none; }
        .jq-range::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:16px; height:16px; border-radius:50%; background:#FF7A4E; border:2px solid #160E22; box-shadow:0 0 0 1px rgba(255,122,78,.45), 0 2px 6px rgba(0,0,0,.5); cursor:pointer; }
        .jq-range::-moz-range-thumb { width:16px; height:16px; border-radius:50%; background:#FF7A4E; border:2px solid #160E22; box-shadow:0 0 0 1px rgba(255,122,78,.45); cursor:pointer; }
      `}</style>
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex flex-col gap-0.5 leading-none">
          <span className="font-mono text-[8px] font-bold uppercase tracking-[0.22em] text-[#FF7A4E]">Atelier · Jaquette</span>
          <span className="font-display font-black uppercase tracking-wide text-white text-lg">Composer ma jaquette</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportPoster}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#EA4423] text-white text-xs font-black uppercase tracking-wide shadow-lg active:scale-95 cursor-pointer disabled:opacity-60"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
            <span>{exporting ? 'Export…' : 'Partager'}</span>
          </button>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-2 rounded-full border border-white/20 text-white/80 hover:text-white active:scale-95 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {/* ── POSTER (mosaïque + logo libre) ── */}
        <div
          ref={posterRef}
          className="relative mx-auto w-full max-w-[340px] aspect-[4/5] overflow-hidden border border-white/10"
          style={{ background: POSTER_BG, boxShadow: '0 20px 50px rgba(0,0,0,.6)' }}
        >
          {/* Cases */}
          {slots.map((slot, i) => {
            const r = rects[i];
            const selected = selectedSlot === i && !logoEdit;
            const key = slot.photoId;
            const src = key ? srcFor(key) : undefined;
            const ratio = key ? ratios[key] : undefined;
            const g = key && ratio !== undefined
              ? placePhoto(aspects[i], ratio, slot.transform.scale, slot.transform.offsetX, slot.transform.offsetY)
              : null;
            return (
              <div
                key={i}
                onPointerDown={(e) => onCasePointerDown(i, e)}
                onPointerMove={onCasePointerMove}
                onPointerUp={(e) => onCasePointerUp(i, e)}
                className="absolute overflow-hidden"
                style={{
                  left: `${r.left * 100}%`,
                  top: `${r.top * 100}%`,
                  width: `${r.width * 100}%`,
                  height: `${r.height * 100}%`,
                  touchAction: 'none',
                  cursor: logoEdit ? 'default' : src ? 'grab' : 'pointer',
                  pointerEvents: logoEdit ? 'none' : 'auto',
                  boxShadow: selected ? `inset 0 0 0 2px ${SELECT_RING}` : undefined,
                  zIndex: selected ? 2 : 1,
                }}
              >
                {src ? (
                  g ? (
                    <img
                      src={src}
                      alt=""
                      draggable={false}
                      onLoad={(e) => onImgLoad(key!, e)}
                      className="absolute max-w-none pointer-events-none"
                      style={{
                        left: `${g.leftPct}%`,
                        top: `${g.topPct}%`,
                        width: `${g.drawWpct}%`,
                        height: `${g.drawHpct}%`,
                      }}
                    />
                  ) : (
                    // ratio pas encore connu → cover CSS le temps du chargement
                    <img
                      src={src}
                      alt=""
                      draggable={false}
                      onLoad={(e) => onImgLoad(key!, e)}
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    />
                  )
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/[0.05]">
                    <Plus size={16} className="text-white/25" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Logo libre (calque au-dessus) */}
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
              zIndex: 5,
            }}
          >
            <div
              className="absolute"
              style={{ inset: '-14% -10%', background: 'radial-gradient(closest-side, rgba(0,0,0,.55), transparent 75%)', filter: 'blur(6px)' }}
            />
            <img
              src={logoUrl}
              alt="Grand Tenerife Auto · Isla Primavera"
              draggable={false}
              className="relative w-full select-none pointer-events-none drop-shadow-[0_3px_10px_rgba(0,0,0,.7)]"
            />
          </div>
        </div>

        {/* ── Atelier (réglages) ── */}
        <div
          className="mx-auto w-full max-w-[340px] mt-3 rounded-xl border border-white/10 overflow-hidden"
          style={{ background: 'rgba(20,12,32,.96)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10">
            <span className="font-display font-black uppercase tracking-wide text-white text-xs">Atelier</span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-white/40">9 cases</span>
          </div>

          <div className="flex flex-col gap-2.5 px-3.5 py-3">
            {/* Logo : déplacer + taille */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setLogoEdit((v) => !v); setSelectedSlot(null); }}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 cursor-pointer border ${
                  logoEdit ? 'text-white border-transparent' : 'bg-white/5 text-white/80 border-white/15'
                }`}
                style={logoEdit ? { background: BRAND } : undefined}
              >
                <Move size={14} />
                {logoEdit ? 'Logo : OK' : 'Déplacer le logo'}
              </button>
              {logoEdit && (
                <label className="flex-1 flex items-center gap-2.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-white/45 shrink-0 w-9">Taille</span>
                  <input
                    type="range" min={0.15} max={1.05} step={0.01} value={logo.w}
                    onChange={(e) => setLogo((l) => ({ ...l, w: parseFloat(e.target.value) }))}
                    className="jq-range flex-1"
                  />
                </label>
              )}
            </div>

            {/* Épaisseur des filets noirs (gutter) — 0,5 % → 4 % de la largeur */}
            <label className="flex items-center gap-2.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-white/45 shrink-0 w-9">Filets</span>
              <input
                type="range" min={0.005} max={0.04} step={0.001} value={gutter}
                onChange={(e) => setGutter(parseFloat(e.target.value))}
                className="jq-range flex-1"
              />
              <span className="font-mono text-[9px] tabular-nums text-white/40 shrink-0 w-9 text-right">
                {(gutter * 100).toFixed(1)}%
              </span>
            </label>

            {/* Cadrage de la case sélectionnée (zoom + vider) */}
            {!logoEdit && selSlot && (
              selSlot.photoId ? (
                <div className="flex items-center gap-2.5 pt-2.5 border-t border-white/10">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-white/45 shrink-0 w-9">Zoom</span>
                  <input
                    type="range" min={1} max={3} step={0.01} value={selSlot.transform.scale}
                    onChange={(e) => setSlotScale(selectedSlot!, parseFloat(e.target.value))}
                    className="jq-range flex-1"
                  />
                  <button
                    onClick={() => emptySlot(selectedSlot!)}
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-red-950/70 border border-red-500/50 text-red-300 text-[10px] font-bold uppercase active:scale-95 cursor-pointer"
                  >
                    <Trash2 size={11} /> Vider
                  </button>
                </div>
              ) : (
                <p className="font-mono text-[10px] uppercase tracking-wider pt-1" style={{ color: SELECT_RING }}>
                  Touche une photo de la réserve pour la case
                </p>
              )
            )}
          </div>
        </div>

        {/* ── RÉSERVE (toute la collection) ── */}
        <div className="mx-auto w-full max-w-[480px] mt-5">
          <div className="flex items-baseline justify-between mb-2.5 px-0.5">
            <span className="font-display font-black uppercase tracking-wide text-white text-sm">Ta collection</span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-white/40">{collection.length} photo{collection.length > 1 ? 's' : ''}</span>
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
                    className={`relative aspect-square rounded-lg overflow-hidden border ${placed ? 'border-[#FF7A4E]/70' : 'border-white/10'} active:scale-95 cursor-pointer`}
                  >
                    <img src={gtaPhotos[e.key] ?? e.original} alt={e.label} className="absolute inset-0 w-full h-full object-cover" />
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
