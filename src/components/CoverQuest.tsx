/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { CATEGORY_MAP } from '../utils/helper';
import { courses } from '../data/coursesData';
import { INITIAL_LOCATIONS } from '../locationsData';
import { buildPhotoCollection } from '../utils/photoCollection';

interface CoverQuestProps {
  /** Course completion (run done) — feeds the 🏁 counter. */
  completedCourseIds: string[];
  /** Course photos (IndexedDB) — principal photos, keyed by course id. */
  coursePhotos: Record<string, string>;
  /** Escapades secondary photos (IndexedDB), keyed by spot id. */
  capturedPhotos: Record<number, string>;
  /** Free "ambiance" photos (IndexedDB), keyed by spot id. */
  spotPhotos: Record<number, string>;
  /** GTA-styled versions, keyed by composite key (course:<id> / loc:<id>).
   *  The display prefers the GTA version when present, else the original. */
  gtaPhotos: Record<string, string>;
  /** Styling status per key: 'pending' (en cours) | 'error'. */
  gtaStatus: Record<string, 'pending' | 'error'>;
  /** Re-run the proxy for one photo (keeps the original). */
  onRegenerate: (key: string) => void;
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
  gtaPhotos,
  gtaStatus,
  onRegenerate,
}: CoverQuestProps) {
  // Per-tile "show the original" override (default: show GTA when available).
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
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
    () => buildPhotoCollection(coursePhotos, capturedPhotos, spotPhotos),
    [coursePhotos, capturedPhotos, spotPhotos],
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

      {/* Galerie de TOUTES les photos. Affiche la version GTA si dispo (toggle
          possible vers l'original), statut de stylisation + bouton régénérer.
          L'original est TOUJOURS conservé intact. */}
      {photos.length === 0 ? (
        <div className="rounded-xl border border-[color:var(--hairline)] px-4 py-10 text-center" style={GLASS}>
          <p className="text-[color:var(--text-muted)] text-xs leading-relaxed">
            Ta collection est vide. Capture des clichés : à l'arrivée des runs, sur les spots photo,
            et via « 📸 Photo ici » sur les lieux.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
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
      )}
    </div>
  );
}
