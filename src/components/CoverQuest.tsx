/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { Lock, Camera, MapPin, ChevronDown } from 'lucide-react';
import { CATEGORY_MAP, haversineKm } from '../utils/helper';
import { courses } from '../data/coursesData';
import {
  COVER_LOCATIONS,
  shortLabel,
  CoverSlot,
  CoverSlotStatus,
  isPhotoSlot,
  PHOTO_UNLOCK_KM,
} from '../coverData';

interface CoverQuestProps {
  completedLocationIds: number[];
  capturedPhotos: Record<number, string>;
  completedTimes: Record<number, string>;
  userCoords: { lat: number; lng: number } | null;
  onOpenCamera: (slot: CoverSlot) => void;
  /** Course completion (string ids) — same state that marks the ✓ on pins. */
  completedCourseIds: string[];
  /** Course photos from IndexedDB ({ [courseId]: base64 }). Separate from the
   *  cover/jaquette photos (capturedPhotos). */
  coursePhotos: Record<string, string>;
}

// Irregular tile heights → GTA-cover collage feel (masonry columns, no gaps).
const ASPECTS = ['aspect-[3/4]', 'aspect-[4/5]', 'aspect-square', 'aspect-[2/3]', 'aspect-[5/6]'];

// Course brand red (route line / El Jefe / Social Club progress).
const COURSE_ACCENT = '#EA4423';

export default function CoverQuest({
  completedLocationIds,
  capturedPhotos,
  completedTimes,
  userCoords,
  onOpenCamera,
  completedCourseIds,
  coursePhotos,
}: CoverQuestProps) {
  const [coursesOpen, setCoursesOpen] = useState(false);

  // Counter scope = non-tutorial courses only (RUN 0 prologue excluded), so the
  // count is consistent with the 100% logic. Y derived from data, never hardcoded.
  const nonTutorialCourses = useMemo(() => courses.filter((c) => !c.tutorial), []);
  const courseTotal = nonTutorialCourses.length;
  const courseDoneCount = nonTutorialCourses.filter((c) =>
    completedCourseIds.includes(c.id),
  ).length;

  // Gallery = non-tutorial courses that already have a captured photo. The GTA
  // grade is baked into the photo at capture, like the jaquette tiles — no extra
  // CSS filter, so the look matches the rest of the Social Club gallery.
  const courseTiles = useMemo(
    () =>
      nonTutorialCourses
        .filter((c) => coursePhotos[c.id])
        .map((c) => ({ id: c.id, title: c.title, trophy: c.trophy, photo: coursePhotos[c.id] })),
    [nonTutorialCourses, coursePhotos],
  );
  const slots: CoverSlot[] = useMemo(() => {
    return COVER_LOCATIONS.map((loc, i) => {
      const filled = completedLocationIds.includes(loc.id);
      let status: CoverSlotStatus = 'locked';
      if (filled) {
        status = 'filled';
      } else if (
        // Only photo slots (Escapades/Plages) are camera-unlockable, at < 500 m.
        // Missions are validated by the 50 m chrono on the map, never here.
        isPhotoSlot(loc.category) &&
        userCoords &&
        haversineKm(userCoords.lat, userCoords.lng, loc.lat, loc.lng) <= PHOTO_UNLOCK_KM
      ) {
        status = 'unlockable';
      }
      return {
        id: loc.id,
        position: i,
        status,
        photoUrl: capturedPhotos[loc.id],
        category: loc.category,
        label: shortLabel(loc),
        location: loc,
      };
    });
  }, [completedLocationIds, capturedPhotos, userCoords]);

  const distanceHint = (slot: CoverSlot): string => {
    if (!userCoords) return 'Active le GPS';
    const km = haversineKm(userCoords.lat, userCoords.lng, slot.location.lat, slot.location.lng);
    // Missions are validated by the chrono on the map, not a photo here.
    const verb = isPhotoSlot(slot.category) ? 'Approche' : 'Chrono';
    return km < 1 ? `${verb} · ${Math.round(km * 1000)} m` : `${verb} · ${km.toFixed(1)} km`;
  };

  return (
    <div className="relative min-h-full pb-28">
      {/* Backdrop = the section's .app-bg (Manrique fresco) — it breathes between
          and through the theme-aware glass trophy tiles. No opaque layer here. */}

      {/* COURSES — compteur + galerie dépliable. Vit UNIQUEMENT ici (cohérent
          avec la barre de complétion). Photos séparées de la jaquette. */}
      <div className="relative z-[2] px-3 pt-3">
        <div
          className="rounded-xl border border-[color:var(--hairline)] overflow-hidden"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(var(--blur-glass))',
            WebkitBackdropFilter: 'blur(var(--blur-glass))',
          }}
        >
          {/* En-tête / compteur — toggle plier/déplier */}
          <button
            onClick={() => setCoursesOpen((o) => !o)}
            aria-expanded={coursesOpen}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
          >
            <span className="flex items-baseline gap-2">
              <span className="font-display font-black uppercase tracking-wide text-[color:var(--text)] text-sm">
                Courses
              </span>
              <span className="font-mono text-xs font-black" style={{ color: COURSE_ACCENT }}>
                {courseDoneCount}/{courseTotal}
              </span>
            </span>
            <ChevronDown
              size={18}
              className={`text-[color:var(--text-muted)] transition-transform duration-300 ${
                coursesOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Corps déplié : galerie des photos de course */}
          {coursesOpen && (
            <div className="px-3 pb-3">
              {courseTiles.length === 0 ? (
                <p className="text-[color:var(--text-muted)] text-xs leading-relaxed py-2 text-center">
                  Aucune course terminée. Décroche ton premier cliché sur la route.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {courseTiles.map((c) => (
                    <div
                      key={c.id}
                      className="relative aspect-[4/5] rounded-xl overflow-hidden border border-white/15"
                    >
                      <img
                        src={c.photo}
                        alt={c.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `linear-gradient(to top, #0a0a0b 6%, ${COURSE_ACCENT}55 42%, transparent 80%)`,
                        }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 p-2.5 flex flex-col gap-0.5">
                        <span className="font-display font-black text-white text-[12px] uppercase tracking-wide leading-tight drop-shadow">
                          {c.title}
                        </span>
                        <span className="font-mono text-[9px] font-bold" style={{ color: '#FF7A4E' }}>
                          🏆 {c.trophy}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Montage of unequal panels (above the app-bg) */}
      <div className="relative z-[1] px-3 pt-3 [column-count:2] sm:[column-count:3] lg:[column-count:4] gap-2.5">
        {slots.map((slot, i) => {
          const accent = CATEGORY_MAP[slot.category].accentColor;
          const aspect = ASPECTS[i % ASPECTS.length];
          const canShoot = slot.status === 'unlockable';

          return (
            <button
              key={slot.id}
              onClick={() => canShoot && onOpenCamera(slot)}
              disabled={!canShoot}
              className={`group relative w-full mb-2.5 inline-block break-inside-avoid overflow-hidden rounded-xl border text-left ${aspect} ${
                canShoot
                  ? 'cursor-pointer border-white/30 cover-pulse'
                  : slot.status === 'filled'
                    ? 'border-white/15 cursor-default'
                    : 'border-[color:var(--hairline)] cursor-not-allowed'
              }`}
              style={canShoot ? { boxShadow: `0 0 0 1.5px ${accent}, 0 0 18px ${accent}55` } : undefined}
            >
              {slot.status === 'filled' && slot.photoUrl ? (
                <>
                  <img
                    src={slot.photoUrl}
                    alt={slot.label}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(to top, #0a0a0b 4%, ${accent}55 40%, transparent 78%)` }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-2.5 flex flex-col gap-0.5">
                    <span className="font-display font-black text-white text-[13px] uppercase tracking-wide leading-none drop-shadow">
                      {slot.label}
                    </span>
                    {completedTimes[slot.id] && (
                      <span className="font-mono text-[9px] font-bold" style={{ color: accent }}>
                        ⏱ {completedTimes[slot.id]}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Locked / unlockable plate — theme-aware glass so the backdrop
                      breathes behind the trophy cards (dark ET light). */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'var(--glass-bg)',
                      backdropFilter: 'blur(var(--blur-glass))',
                      WebkitBackdropFilter: 'blur(var(--blur-glass))',
                    }}
                  />
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 1px, transparent 1px 3px)',
                    }}
                  />
                  {canShoot && (
                    <div
                      className="absolute inset-0 opacity-40"
                      style={{ background: `radial-gradient(90% 70% at 50% 40%, ${accent}45, transparent 70%)` }}
                    />
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center">
                    {canShoot ? (
                      <span
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: accent }}
                      >
                        <Camera size={18} className="text-white" />
                      </span>
                    ) : (
                      <span className="w-9 h-9 rounded-full bg-[color:var(--hairline)] border border-[color:var(--hairline)] flex items-center justify-center">
                        <Lock size={15} className="text-[color:var(--text-muted)]" />
                      </span>
                    )}
                    <span className="font-display font-black text-[11px] uppercase tracking-wide text-[color:var(--text)] leading-tight">
                      {slot.label}
                    </span>
                    <span
                      className={`flex items-center gap-1 font-mono text-[8px] uppercase tracking-wider ${
                        canShoot ? 'font-black' : 'text-[color:var(--text-muted)]'
                      }`}
                      style={canShoot ? { color: accent } : undefined}
                    >
                      {canShoot ? (
                        'Prends la photo !'
                      ) : (
                        <>
                          <MapPin size={8} /> {distanceHint(slot)}
                        </>
                      )}
                    </span>
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Fixed central cover logo (overlay, non-interactive) */}
      <div className="cover-logo">
        <div className="ctitle">
          GRAND<br />TENERIFE<br />AUTO
        </div>
        <div className="cshield">
          <span></span>
          <b>IP</b>
          <span></span>
        </div>
        <div className="csub">ISLA PRIMAVERA</div>
      </div>

      <style>{`
        .cover-logo{position:fixed;top:42%;left:50%;transform:translate(-50%,-50%);
          z-index:5;pointer-events:none;display:flex;flex-direction:column;align-items:center;
          filter:drop-shadow(0 8px 18px rgba(0,0,0,.55))}
        .cover-logo::before{content:'';position:absolute;inset:-46px -70px;z-index:-1;
          background:radial-gradient(closest-side, rgba(10,10,11,.62), transparent)}
        .ctitle{font:700 32px/.82 'Space Grotesk',sans-serif;letter-spacing:-1.5px;color:#fff;
          -webkit-text-stroke:2.5px #0a0a0b;text-align:center;text-shadow:0 3px 0 rgba(0,0,0,.4)}
        .cshield{display:flex;align-items:center;gap:7px;margin-top:5px}
        .cshield span{height:3px;width:34px;background:#fff;box-shadow:0 0 0 2px #0a0a0b}
        .cshield b{font:700 24px 'Space Grotesk',sans-serif;color:#46AE3C;-webkit-text-stroke:2.5px #0a0a0b}
        .csub{font:700 11px 'Space Grotesk',sans-serif;letter-spacing:3px;color:#fff;-webkit-text-stroke:1px #0a0a0b;margin-top:4px}
        @keyframes coverPulse{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
        .cover-pulse{animation:coverPulse 1.8s ease-in-out infinite}
      `}</style>
    </div>
  );
}
