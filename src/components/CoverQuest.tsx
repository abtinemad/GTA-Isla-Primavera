/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
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
}: CoverQuestProps) {
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

      {/* Galerie de TOUTES les photos capturées (originaux non gradés ; la
          stylisation GTA viendra de l'API image en version séparée) */}
      {photos.length === 0 ? (
        <div className="rounded-xl border border-[color:var(--hairline)] px-4 py-10 text-center" style={GLASS}>
          <p className="text-[color:var(--text-muted)] text-xs leading-relaxed">
            Ta collection est vide. Capture des clichés : à l'arrivée des runs, sur les spots photo,
            et via « 📸 Photo ici » sur les lieux.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {photos.map((p) => (
            <div
              key={p.key}
              className="relative aspect-[4/5] rounded-xl overflow-hidden border border-white/15"
            >
              <img
                src={gtaPhotos[p.key] ?? p.original}
                alt={p.label}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(to top, #0a0a0b 6%, ${p.accent}55 42%, transparent 80%)` }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-2.5">
                <span className="font-display font-black text-white text-[11px] uppercase tracking-wide leading-tight drop-shadow truncate block">
                  {p.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
