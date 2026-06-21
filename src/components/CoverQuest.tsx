/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState, useRef, type ChangeEvent } from 'react';
import { RefreshCw, Plus, Trash2 } from 'lucide-react';
import { CATEGORY_MAP } from '../utils/helper';
import { courses } from '../data/coursesData';
import { INITIAL_LOCATIONS } from '../locationsData';
import { buildPhotoCollection } from '../utils/photoCollection';
import { compressImage } from '../utils/imageCompress';

interface CoverQuestProps {
  /** Course completion (run done) — feeds the 🏁 counter. */
  completedCourseIds: string[];
  /** Course photos (IndexedDB) — principal photos, keyed by course id. */
  coursePhotos: Record<string, string>;
  /** Escapades secondary photos (IndexedDB), keyed by spot id. */
  capturedPhotos: Record<number, string>;
  /** Free "ambiance" photos (IndexedDB), keyed by spot id. */
  spotPhotos: Record<number, string>;
  /** Perso photos (IndexedDB), keyed by uuid — supplémentaires, supprimables. */
  freePhotos: Record<string, string>;
  /** GTA-styled versions, keyed by composite key (course:<id> / loc:<id> / free:<id>).
   *  The display prefers the GTA version when present, else the original. */
  gtaPhotos: Record<string, string>;
  /** Styling status per key: 'pending' (en cours) | 'error'. */
  gtaStatus: Record<string, 'pending' | 'error'>;
  /** Re-run the proxy for one photo (keeps the original). */
  onRegenerate: (key: string) => void;
  /** Add a perso photo (already compressed ~1280 px). */
  onAddFreePhoto: (base64: string) => void;
  /** Delete a perso photo by its uuid (original + GTA version). */
  onDeleteFreePhoto: (id: string) => void;
}

// Course brand red (route line / El Jefe).
const COURSE_ACCENT = '#EA4423';
const PRINCIPAL_ACCENT = '#FF7A4E';

const GLASS = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(var(--blur-glass))',
  WebkitBackdropFilter: 'blur(var(--blur-glass))',
} as const;

function Counter({
  emoji,
  label,
  x,
  y,
  accent,
}: {
  emoji: string;
  label: string;
  x: number;
  y: number;
  accent: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 px-2 py-3">
      <span className="text-base leading-none">{emoji}</span>
      <span className="font-mono text-sm font-black" style={{ color: accent }}>
        {x}/{y}
      </span>
      <span className="font-mono text-[8px] uppercase tracking-wider text-[color:var(--text-muted)] text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

export default function CoverQuest({
  completedCourseIds,
  coursePhotos,
  capturedPhotos,
  spotPhotos,
  freePhotos,
  gtaPhotos,
  gtaStatus,
  onRegenerate,
  onAddFreePhoto,
  onDeleteFreePhoto,
}: CoverQuestProps) {
  // Per-tile "show the original" override (default: show GTA when available).
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAddFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const compressed = await compressImage(reader.result as string, 1280, 0.85);
      onAddFreePhoto(compressed);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // re-pick the same file possible
  };
  // Counters (informative X/Y, no global completion). Totals derived from data.
  const nonTutorialCourses = useMemo(() => courses.filter((c) => !c.tutorial), []);
  const courseTotal = nonTutorialCourses.length; // 7
  const courseDoneCount = nonTutorialCourses.filter((c) => completedCourseIds.includes(c.id)).length;
  const principalCount = nonTutorialCourses.filter((c) => coursePhotos[c.id]).length;

  // Secondary = Escapades photo-annexe (Drago / Los Gigantes / Montaña Roja).
  const secondaryLocations = useMemo(
    () => INITIAL_LOCATIONS.filter((l) => l.category === 'Escapades'),
    [],
  );
  const secondaryTotal = secondaryLocations.length; // 3
  const secondaryCount = secondaryLocations.filter((l) => capturedPhotos[l.id]).length;

  // Gallery = ALL photos, merged/deduped/sorted by the shared collection helper
  // (same source the styling queue uses). Display prefers the GTA version.
  const photos = useMemo(
    () => buildPhotoCollection(coursePhotos, capturedPhotos, spotPhotos, freePhotos),
    [coursePhotos, capturedPhotos, spotPhotos, freePhotos],
  );

  return (
    <div className="relative min-h-full px-3 pt-3 pb-28">
      {/* Header + 3 compteurs informatifs (pas de % global) */}
      <div className="rounded-xl border border-[color:var(--hairline)] overflow-hidden mb-3" style={GLASS}>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="font-display font-black uppercase tracking-wide text-[color:var(--text)] text-sm">
            Social Club
          </span>
          <span className="font-mono text-[10px] text-[color:var(--text-muted)]">
            {photos.length} cliché{photos.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="grid grid-cols-3 border-t border-[color:var(--hairline)] divide-x divide-[color:var(--hairline)]">
          <Counter emoji="🏁" label="Courses" x={courseDoneCount} y={courseTotal} accent={COURSE_ACCENT} />
          <Counter emoji="📸" label="Principales" x={principalCount} y={courseTotal} accent={PRINCIPAL_ACCENT} />
          <Counter
            emoji="📸"
            label="Secondaires"
            x={secondaryCount}
            y={secondaryTotal}
            accent={CATEGORY_MAP['Escapades'].accentColor}
          />
        </div>
      </div>

      {/* Galerie de TOUTES les photos (course + secondaires + ambiance + perso).
          Affiche la version GTA si dispo (toggle vers l'original), statut + régénérer.
          L'original est TOUJOURS conservé. Tuile « + » en tête pour ajouter ses
          propres photos (supplémentaires, supprimables). */}
      <div className="grid grid-cols-3 gap-2">
        {/* + Ajouter une photo perso (sélecteur OS : appareil ou pellicule) */}
        <button
          onClick={() => fileRef.current?.click()}
          className="relative aspect-[4/5] rounded-xl border-2 border-dashed border-[color:var(--hairline)] flex flex-col items-center justify-center gap-1.5 text-[color:var(--text-muted)] hover:text-[color:var(--text)] hover:border-white/40 transition-colors cursor-pointer"
          style={GLASS}
        >
          <Plus size={22} />
          <span className="font-mono text-[9px] uppercase tracking-wider text-center px-2 leading-tight">
            Ajouter une photo
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleAddFile} className="hidden" />

        {photos.map((p) => {
            const hasGta = !!gtaPhotos[p.key];
            const showOrig = !hasGta || !!showOriginal[p.key];
            const status = gtaStatus[p.key];
            return (
              <div
                key={p.key}
                className="relative aspect-[4/5] rounded-xl overflow-hidden border border-white/15"
              >
                <img
                  src={showOrig ? p.original : gtaPhotos[p.key]}
                  alt={p.label}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(to top, #0a0a0b 6%, ${p.accent}55 42%, transparent 80%)` }}
                />

                {/* Contrôles : toggle GTA/Original + régénérer */}
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                  {hasGta && (
                    <button
                      onClick={() => setShowOriginal((s) => ({ ...s, [p.key]: !s[p.key] }))}
                      className="px-1.5 py-0.5 rounded-md bg-black/60 border border-white/25 text-white text-[8px] font-mono font-black uppercase tracking-wider active:scale-95 cursor-pointer"
                    >
                      {showOrig ? 'Orig' : 'GTA'}
                    </button>
                  )}
                  <button
                    onClick={() => onRegenerate(p.key)}
                    title="Régénérer le style GTA"
                    aria-label="Régénérer"
                    className="w-5 h-5 rounded-md bg-black/60 border border-white/25 text-white flex items-center justify-center active:scale-95 cursor-pointer"
                  >
                    <RefreshCw size={10} className={status === 'pending' ? 'animate-spin' : ''} />
                  </button>
                  {p.key.startsWith('free:') && (
                    <button
                      onClick={() => onDeleteFreePhoto(p.key.slice('free:'.length))}
                      title="Supprimer cette photo perso"
                      aria-label="Supprimer"
                      className="w-5 h-5 rounded-md bg-red-950/70 border border-red-500/50 text-red-300 flex items-center justify-center active:scale-95 cursor-pointer"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>

                {/* Statut de stylisation */}
                {status === 'pending' && (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 border border-white/20 text-[8px] font-mono text-amber-300 uppercase tracking-wider animate-pulse">
                    ✨ GTA…
                  </div>
                )}
                {status === 'error' && (
                  <button
                    onClick={() => onRegenerate(p.key)}
                    className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-red-950/80 border border-red-500/50 text-[8px] font-mono text-red-300 uppercase tracking-wider active:scale-95 cursor-pointer"
                  >
                    ⚠ réessayer
                  </button>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <span className="font-display font-black text-white text-[11px] uppercase tracking-wide leading-tight drop-shadow truncate block">
                    {p.label}
                  </span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
