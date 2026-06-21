/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { LocationItem } from '../types';
import { CourseData } from '../data/coursesData';
import { CATEGORY_MAP, categoryIconSvg } from '../utils/helper';
import { isPhotoSlot } from '../coverData';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Navigation, 
  MapPin, 
  X,
  Share2,
  ExternalLink,
  Milestone,
  CheckCircle2,
  Camera,
  Loader2,
  Sparkles,
  Trophy,
  Play,
  Square,
  Flag,
  Timer,
  Route,
  Globe,
  Instagram
} from 'lucide-react';

const LOCATION_TROPHIES: Record<number, string> = {
  7: "Au-dessus des Nuages",
  8: "Roi de la Gomme",
  9: "Maître du Flow",
  10: "Chasseur de Fantômes",
  12: "Grand Tourer",
  13: "Grand Tourer",
  17: "Chasseur de Criques",
  18: "Contraste Total"
};

// Co-validation photo radius for Escapades / Plages, in km. Wider than the
// mission chrono geofence (50 m) because these spots are landscapes/beaches
// that are photographed from a distance.
const PHOTO_VALIDATION_RADIUS_KM = 0.5; // 500 m

interface BottomSheetProps {
  location: LocationItem | null;
  /** When set, the sheet renders a race (course) instead of a spot. */
  course?: CourseData | null;
  onClose: () => void;
  onCenterOnMap?: (location: LocationItem) => void;
  userCoords?: { lat: number; lng: number } | null;
  isCompleted?: boolean;
  onCompleteLocation?: (location: LocationItem, finishTime?: string) => void;
  /** Fired when the player launches navigation (Google Maps) toward the spot. */
  onLaunchNavigation?: () => void;

  // Game state injection
  activeRunLocationId: number | null;
  onStartRun: (locId: number) => void;
  onStopRun: () => void;
  elapsedTime: number;
  onSavePhoto: (locId: number, base64: string) => void;
  // Course chrono run (string id) — separate from the spot run above.
  activeRunCourseId?: string | null;
  onStartCourseRun?: (course: CourseData) => void;
  completedCourseIds?: string[];
  /** Free "ambiance" photo on a POI spot (no geofence) → IndexedDB collection. */
  onCaptureSpotPhoto?: (locId: number, base64: string) => void;
}

export default function BottomSheet({
  location,
  course,
  onClose,
  onCenterOnMap,
  userCoords,
  isCompleted = false,
  onCompleteLocation,
  onLaunchNavigation,
  activeRunLocationId,
  onStartRun,
  onStopRun,
  elapsedTime,
  onSavePhoto,
  activeRunCourseId = null,
  onStartCourseRun,
  completedCourseIds = [],
  onCaptureSpotPhoto,
}: BottomSheetProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [gpsErrorShow, setGpsErrorShow] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ref de l'input « Photo ici » (ambiance). DOIT rester ici, AVANT le `return null`
  // conditionnel plus bas, sinon le nombre de hooks change entre les rendus
  // (location null vs défini) → crash « Rendered more hooks… » (page blanche).
  const ambianceInputRef = useRef<HTMLInputElement>(null);
  // Mission chrono — filet manuel : temps figé en attente de validation (null = pas
  // d'attente). + l'input photo de validation Mission. Hooks AVANT le return.
  const [pendingTime, setPendingTime] = useState<string | null>(null);
  const missionPhotoInputRef = useRef<HTMLInputElement>(null);

  // Verification-flow cancellation token. Bumped whenever the targeted spot
  // changes or the sheet closes, so an in-flight (decorative) analysis can't
  // complete a stale location or save its photo after the user has moved on.
  const verifyTokenRef = useRef(0);
  useEffect(() => {
    setPendingTime(null); // reset l'attente de validation quand on change de spot
    return () => {
      verifyTokenRef.current++;
    };
  }, [location?.id]);

  // ─── RACE (COURSE) SHEET ───────────────────────────────────────────────────
  // Rendered when a course is selected (its depart pin was tapped). Reuses the
  // existing bottom-sheet shell. "Y aller" deep-links navigation to the START
  // (that's where the race begins) — Google Maps / Waze / Apple Plans.
  if (course) {
    const { lat, lng } = course.start;
    const navLinks = [
      { label: 'Google Maps', href: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` },
      { label: 'Waze', href: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` },
      { label: 'Plans', href: `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d` },
    ];
    const chronoMin = Math.round(course.chronoIndicatifSec / 60);

    return (
      <AnimatePresence>
        <div
          className="fixed inset-0 z-[1000] pointer-events-none flex items-end justify-center px-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950 pointer-events-auto md:hidden"
          />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative w-full max-w-lg bg-white border border-zinc-200 rounded-3xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col"
          >
            <div className="w-full flex justify-center pt-3 pb-2 cursor-pointer md:cursor-default" onClick={onClose}>
              <div className="w-12 h-1.5 rounded-full bg-zinc-250" />
            </div>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full border border-zinc-200 bg-zinc-100/95 text-zinc-550 hover:text-black transition-all cursor-pointer z-10 shadow-xs"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>

            <div className="p-6 pt-2 overflow-y-auto max-h-[75dvh]">
              {/* Badge course + tutorial tag */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-lg border flex items-center gap-1.5 bg-[#EA4423]/15 text-[#C2371B] border-[#EA4423]/30">
                  <Flag size={12} />
                  <span>Course</span>
                </span>
                {course.tutorial && (
                  <span className="bg-sky-50 text-sky-800 border border-sky-200 px-2 py-1 text-[10px] font-bold tracking-wider rounded-lg uppercase">
                    Prologue · hors 100%
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="font-display text-xl md:text-2xl font-extrabold text-zinc-950 tracking-tight leading-snug mb-2">
                {course.title}
              </h3>

              {/* Trophy */}
              <div className="mb-4 bg-amber-500/10 border border-amber-520/20 rounded-2xl p-3 flex items-center gap-2.5">
                <Trophy size={18} className="text-amber-500 shrink-0" />
                <div className="text-left">
                  <span className="block text-[10px] uppercase font-bold text-amber-800 tracking-wider">Trophée</span>
                  <span className="block text-xs font-extrabold text-zinc-900">{course.trophy}</span>
                </div>
              </div>

              {/* Distance + indicative chrono */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-center gap-2.5 shadow-xs">
                  <Route size={18} className="text-red-600 shrink-0" />
                  <div className="text-left">
                    <span className="block text-[10px] uppercase font-bold text-red-700 tracking-wider">Distance</span>
                    <span className="block text-sm font-black text-zinc-900 font-mono">{course.distanceKm} km</span>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-center gap-2.5 shadow-xs">
                  <Timer size={18} className="text-red-600 shrink-0" />
                  <div className="text-left">
                    <span className="block text-[10px] uppercase font-bold text-red-700 tracking-wider">Chrono indicatif</span>
                    <span className="block text-sm font-black text-zinc-900 font-mono">{chronoMin} min</span>
                  </div>
                </div>
              </div>

              {/* Axe */}
              <div className="flex items-center gap-2 font-mono text-xs text-zinc-600 bg-zinc-50 px-3 py-2 rounded-xl border border-zinc-200 mb-4">
                <Milestone size={13} className="text-zinc-500 shrink-0" />
                <span className="text-zinc-400 font-bold uppercase">Axe :</span>
                <span className="text-zinc-800 font-semibold">{course.axe}</span>
              </div>

              {/* Note */}
              <div className="mb-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Briefing</h4>
                <p className="text-sm text-zinc-700 leading-relaxed bg-zinc-50 p-4 border border-zinc-200 rounded-2xl font-sans">
                  {course.note}
                </p>
              </div>

              {/* Visuel — at the photo point: start if photoAtStart, else arrival */}
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center gap-1.5">
                  <Camera size={13} className="text-zinc-500" />
                  {course.photoAtStart ? 'Au départ (photo)' : "À l'arrivée (photo)"}
                </h4>
                <p className="text-sm text-zinc-700 leading-relaxed bg-amber-50/60 p-4 border border-amber-200/70 rounded-2xl font-sans italic">
                  {course.visuel}
                </p>
              </div>

              {/* Démarrer le run (chrono) — run fait / en cours / à lancer. Le
                  chrono s'arrête seul au géofence 50 m de l'arrivée. */}
              {onStartCourseRun && (
                <div className="mb-3">
                  {completedCourseIds.includes(course.id) ? (
                    <div className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-bold">
                      <Trophy size={16} /> Run validé · « {course.trophy} »
                    </div>
                  ) : activeRunCourseId === course.id ? (
                    <div className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-red-50 border border-red-300 text-red-700 text-sm font-bold animate-pulse">
                      <Timer size={16} /> Run en cours…
                    </div>
                  ) : (
                    <button
                      onClick={() => onStartCourseRun(course)}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#EA4423] hover:bg-[#d63d1f] text-white text-sm font-black uppercase tracking-wide transition-all shadow-lg active:scale-95 cursor-pointer"
                    >
                      <Timer size={16} /> Démarrer le run (chrono)
                    </button>
                  )}
                </div>
              )}

              {/* "Y aller" — deep-link navigation to the START */}
              <div className="flex flex-col gap-2">
                <a
                  href={navLinks[0].href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-zinc-950 hover:bg-zinc-900 text-white text-sm font-bold transition-all duration-200 shadow-lg cursor-pointer active:scale-95 text-center"
                  style={{ boxShadow: '0 4px 14px rgba(234,68,35,0.25)' }}
                >
                  <Navigation size={15} fill="currentColor" />
                  <span>Y aller (point de départ)</span>
                  <ExternalLink size={13} className="opacity-60" />
                </a>
                <div className="grid grid-cols-2 gap-2">
                  {navLinks.slice(1).map((l) => (
                    <a
                      key={l.label}
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-250 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-95 shadow-sm"
                    >
                      <Navigation size={13} className="text-zinc-500" />
                      <span>{l.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  // Hooks must run on every render — bail out only after they are declared,
  // otherwise the hook count changes between renders (Rules of Hooks).
  if (!location) return null;

  const catInfo = CATEGORY_MAP[location.category];
  const associatedTrophy = LOCATION_TROPHIES[location.id];

  // Boutons de liens externes (site / Instagram / TikTok) — style GTA-HUD à l'accent
  // catégorie, partagé par les 3 icônes.
  const socialBtnClass =
    'flex items-center justify-center w-11 h-11 rounded-xl border-2 bg-white hover:bg-zinc-50 transition-all duration-200 shadow-sm cursor-pointer active:scale-95';
  const socialBtnStyle = { borderColor: `${catInfo.accentColor}55`, color: catInfo.accentColor };

  // Calculate distance in km
  const getRawDistanceKm = () => {
    if (!userCoords) return null;
    const R = 6371; // km
    const dLat = ((location.lat - userCoords.lat) * Math.PI) / 180;
    const dLng = ((location.lng - userCoords.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userCoords.lat * Math.PI) / 180) *
        Math.cos((location.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const rawDist = getRawDistanceKm();

  const getDistanceString = () => {
    if (rawDist === null) return null;
    if (rawDist < 1) {
      return `${Math.round(rawDist * 1000)} m`;
    }
    return `${rawDist.toFixed(1)} km`;
  };

  const distance = getDistanceString();

  // Create Google Maps direct intent URL
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;

  const shareLocation = () => {
    if (navigator.share) {
      navigator.share({
        title: location.name,
        text: `${location.name} - ${location.info}`,
        url: window.location.href
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(`${location.name}: ${location.info} (${location.lat}, ${location.lng})`);
      alert("Coordonnées copiées !");
    }
  };

  const clickInput = () => {
    fileInputRef.current?.click();
  };

  // Free "ambiance" capture (no geofence, no co-validation) — beach clubs/restos/
  // ravito/bars/plages. Compresses and hands the photo to the IndexedDB collection.
  // (Le ref ambianceInputRef est déclaré tout en haut, avant le return conditionnel.)
  const handleAmbianceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !location) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const compressed = await compressPhoto(reader.result as string);
      onCaptureSpotPhoto?.(location.id, compressed);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // allow re-picking the same file
  };

  // Resizes & compresses uploaded photo to avoid localstorage quota overflow (>5MB)
  const compressPhoto = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Original haute-déf (Gemini + poster), resize/compression seulement.
        const max_size = 1280;
        if (width > height) {
          if (width > max_size) {
            height *= max_size / width;
            width = max_size;
          }
        } else {
          if (height > max_size) {
            width *= max_size / height;
            height = max_size;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Stocke l'ORIGINAL non gradé : la stylisation GTA viendra de l'API
          // image (proxy serverless) — ne pas pré-grader pour éviter le double
          // traitement. Seul un resize/compression pour le quota de stockage.
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Photo spots (Escapades / Plages) are landscapes framed from a distance —
    // a beach panorama or a mountain can't be shot from 50 m. Use a 500 m radius.
    const isWithinRange = rawDist !== null && rawDist <= PHOTO_VALIDATION_RADIUS_KM;

    if (!isWithinRange) {
      setGpsErrorShow(true);
      return;
    }

    setGpsErrorShow(false);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const rawBase64 = reader.result as string;
      const compressed = await compressPhoto(rawBase64);
      setCapturedImage(compressed);
      startVerificationFlow(compressed);
    };
    reader.readAsDataURL(file);
  };

  const startVerificationFlow = async (compressedImg: string) => {
    // Snapshot a token; if the sheet closes / spot changes, alive() turns false
    // and we abort before any persistence — no stale completion.
    const myToken = ++verifyTokenRef.current;
    const alive = () => verifyTokenRef.current === myToken;

    setIsAnalyzing(true);
    setAnalysisLogs([
      "[SYSTEM] Capture de la photo souvenir...",
      "[SYSTEM] Image acquise (résolution compressée).",
      "[GPS] Co-validation géoréférencée : proximité < 500 m confirmée."
    ]);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    await sleep(700);
    if (!alive()) return;
    setAnalysisLogs(prev => [...prev, "[GPS] Position verrouillée sur les coordonnées du spot."]);

    await sleep(900);
    if (!alive()) return;
    setAnalysisLogs(prev => [...prev, "[SYSTEM] Recoupement photo + GPS en cours..."]);

    await sleep(1000);
    if (!alive()) return;
    setAnalysisLogs(prev => [
      ...prev,
      JSON.stringify({ valide: true, distance: '< 500 m', spot: location.name, photo: 'enregistrée' }, null, 2)
    ]);

    await sleep(700);
    if (!alive()) return;
    setAnalysisLogs(prev => [...prev, "[SYSTEM] Co-validation réussie. Sauvegarde du souvenir..."]);

    // Save compressed image persistently in local storage
    onSavePhoto(location.id, compressedImg);

    await sleep(600);
    if (!alive()) return;
    setIsAnalyzing(false);
    setCapturedImage(null);
    setAnalysisLogs([]);
    if (onCompleteLocation) {
      onCompleteLocation(location);
    }
  };

  // Time formatter
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const h = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${h.toString().padStart(2, '0')}`;
  };

  const isCurrentRunActive = activeRunLocationId === location.id;

  // ── Mission chrono — FILET MANUEL (le géofence n'est qu'un déclencheur bonus) ──
  // « Arrêter le chrono » : fige le temps AVANT le reset, puis demande validation.
  const stopMissionForValidation = () => {
    setPendingTime(formatTime(elapsedTime)); // capture le temps courant
    onStopRun();                              // arrête le moteur (handler existant)
  };
  // « Valider + photo » : enregistre la photo (→ Social Club) et complète la mission
  // avec le temps en métadonnée (completedTimes). Pas de géofence requis (filet).
  const handleMissionPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || pendingTime === null) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const compressed = await compressPhoto(reader.result as string);
      onSavePhoto(location.id, compressed);          // photo → capturedPhotos (Social Club)
      onCompleteLocation?.(location, pendingTime);    // complétion + temps (handler existant)
      setPendingTime(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] pointer-events-none flex items-end justify-center px-4 pb-4 md:pb-6">
        
        {/* Backdrop on mobile only - tap to close */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-zinc-950 pointer-events-auto md:hidden"
        />

        {/* The sliding Bottom Sheet panel */}
        <motion.div
          id={`location-card-${location.id}`}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative w-full max-w-lg bg-white border border-zinc-200 rounded-3xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col"
        >
          {/* Top handle bar (native PWA style) */}
          <div className="w-full flex justify-center pt-3 pb-2 cursor-pointer md:cursor-default" onClick={onClose}>
            <div className="w-12 h-1.5 rounded-full bg-zinc-250" />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full border border-zinc-200 bg-zinc-100/95 text-zinc-550 hover:text-black transition-all cursor-pointer z-10 shadow-xs"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>

          {/* Hidden native camera capture input */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            className="hidden"
          />

          {/* Photo de validation Mission (après « Valider ce temps ») */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={missionPhotoInputRef}
            onChange={handleMissionPhoto}
            className="hidden"
          />

          {/* Body Content */}
          <div className="p-6 pt-2 overflow-y-auto max-h-[75dvh]">
            
            {/* Category badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-lg border flex items-center gap-1.5 ${catInfo.bgClass}`}>
                <span
                  className="inline-block w-3.5 h-3.5 shrink-0"
                  aria-hidden
                  dangerouslySetInnerHTML={{ __html: categoryIconSvg(location.category) }}
                />
                <span>{catInfo.label}</span>
              </span>
              {location.custom && (
                <span className="bg-amber-50 text-amber-805 border border-amber-250 px-2 py-1 text-[10px] font-semibold tracking-wider rounded-lg uppercase">
                  Custom Intel
                </span>
              )}
              {isCompleted && (
                <span className="bg-amber-100 text-amber-950 border border-amber-300 px-2.5 py-1 text-[10px] font-black tracking-wider rounded-lg uppercase flex items-center gap-1 animate-pulse">
                  <Trophy size={11} className="text-amber-600 shrink-0" />
                  ACCOMPLI
                </span>
              )}
              {distance && (
                <span className="bg-zinc-100 text-zinc-800 border border-zinc-200 px-2 py-1 text-[11px] font-mono rounded-lg flex items-center gap-1">
                  <Milestone size={11} className="text-zinc-650" />
                  {distance}
                </span>
              )}
            </div>

            {/* Title / Name */}
            <h3 className="font-display text-xl md:text-2xl font-extrabold text-zinc-950 tracking-tight leading-snug mb-2">
              {location.name}
            </h3>

            {/* Trophy Associated Block */}
            {associatedTrophy && (
              <div className="mb-4 bg-amber-500/10 border border-amber-520/20 rounded-2xl p-3 flex items-center gap-2.5">
                <Trophy size={18} className="text-amber-500 shrink-0 animate-bounce" />
                <div className="text-left">
                  <span className="block text-[10px] uppercase font-bold text-amber-800 tracking-wider">Trophée liant :</span>
                  <span className="block text-xs font-extrabold text-zinc-900">{associatedTrophy}</span>
                </div>
              </div>
            )}

            {/* Coordinates widget */}
            <div className="flex items-center gap-3 font-mono text-xs text-zinc-500 bg-zinc-50 px-3 py-2 rounded-xl border border-zinc-200 mb-4">
              <div className="flex items-center gap-1">
                <span className="text-zinc-400 font-bold">LAT:</span>
                <span className="text-zinc-800 font-semibold">{location.lat.toFixed(5)}</span>
              </div>
              <div className="w-px h-3 bg-zinc-200" />
              <div className="flex items-center gap-1">
                <span className="text-zinc-400 font-bold">LNG:</span>
                <span className="text-zinc-800 font-semibold">{location.lng.toFixed(5)}</span>
              </div>
            </div>

            {/* Information / Description */}
            <div className="space-y-4 mb-6">
              
              {/* Gameplay Photo verification console overlay if active */}
              {isAnalyzing && (
                <div className="relative overflow-hidden bg-zinc-950 border border-zinc-800 rounded-2xl p-4 font-mono text-[10px] text-zinc-300 flex flex-col gap-3 shadow-2xl">
                  {/* Neon scan indicator banner */}
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <div className="flex items-center gap-2 text-amber-400 font-bold">
                      <Loader2 size={12} className="animate-spin" />
                      <span>CO-VALIDATEUR GPS &amp; PHOTO</span>
                    </div>
                    <span className="text-zinc-500 font-bold uppercase tracking-wider">GPS + PHOTO</span>
                  </div>

                  {/* Twin column: left console, right dynamic thumbnail with sweeping line scan */}
                  <div className="flex gap-4 items-start">
                    <div className="flex-1 flex flex-col gap-1 max-h-[140px] overflow-y-auto no-scrollbar text-zinc-400 leading-normal">
                      {analysisLogs.map((log, index) => {
                        const isJson = log.startsWith('{');
                        const isGps = log.startsWith("[GPS]");
                        const isSystem = log.startsWith("[SYSTEM]");
                        let clr = "text-zinc-400";
                        if (isJson) clr = "text-emerald-400 font-semibold leading-tight whitespace-pre bg-zinc-900/50 p-1.5 rounded border border-zinc-850";
                        if (isGps) clr = "text-amber-300 font-semibold";
                        if (isSystem) clr = "text-sky-400";
                        return (
                          <div key={index} className={`${clr} break-words`}>
                            {log}
                          </div>
                        );
                      })}
                      <div className="text-amber-500 animate-pulse mt-1">█ CO-VALIDATION GPS + PHOTO...</div>
                    </div>

                    {capturedImage && (
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-zinc-800 shrink-0 select-none bg-zinc-900">
                        <img src={capturedImage} alt="Captured photo souvenir" className="w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#E1C233]/40 to-transparent w-full h-[6px] scan-line-anim" />
                      </div>
                    )}
                  </div>

                  <style>{`
                    @keyframes scan {
                      0% { top: 0%; }
                      50% { top: 95%; }
                      100% { top: 0%; }
                    }
                    .scan-line-anim {
                      position: absolute;
                      animation: scan 1.8s linear infinite;
                    }
                  `}</style>
                </div>
              )}

              {gpsErrorShow && (
                <div className="bg-rose-50 border border-rose-220 rounded-2xl p-4 flex flex-col gap-2.5 shadow-sm text-left">
                  <div className="flex items-center gap-2 text-rose-800 font-extrabold text-xs uppercase">
                    <span className="w-2 h-2 rounded-full bg-rose-550 animate-ping shrink-0" />
                    <span>Erreur : Hors de portée GPS</span>
                  </div>
                  <p className="text-xs text-rose-700 font-medium leading-relaxed leading-sans">
                    Vous êtes actuellement situé à <span className="font-bold">{distance || 'plus de 5 km'}</span> de l'objectif. La co-validation par photo requiert d'être à moins de <span className="font-bold">500 mètres</span> du spot. Rapprochez-vous pour débloquer le trophée.
                  </p>
                </div>
              )}

              {!isAnalyzing && !gpsErrorShow && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Instructions & Info</h4>
                  <p className="text-sm text-zinc-700 leading-relaxed bg-zinc-50 p-4 border border-zinc-200 rounded-2xl font-sans">
                    {location.info}
                  </p>
                </div>
              )}

              {/* Action details if it is a Mission */}
              {location.category === 'Missions' && (
                <div className="bg-red-50 border border-red-200 p-3.5 rounded-2xl flex items-start gap-3 shadow-xs">
                  <Flag size={18} className="text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-xs font-bold text-red-700 tracking-wide uppercase">Briefing Épreuve Chrono</span>
                    <span className="block text-xs text-zinc-650 mt-0.5 leading-normal">
                      Démarrez le chrono puis rejoignez la destination. Le timer s'arrête automatiquement dès votre entrée dans le périmètre de 50&nbsp;m.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* PHOTO VALIDATION — Escapades ET Plages (co-validation photo, géofence
                  <500 m). Même bouton, même flux capture→enregistrement→complétion.
                  `isPhotoSlot` (coverData) est la source unique des catégories validables
                  par photo. */}
              {isPhotoSlot(location.category) && !isCompleted && !isAnalyzing && (
                <button
                  onClick={clickInput}
                  className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl border border-dashed border-sky-300 bg-sky-50/70 hover:bg-sky-50 text-sky-900 text-sm font-extrabold transition-all duration-200 cursor-pointer active:scale-95 shadow-sm hover:border-sky-400 group col-span-1 sm:col-span-2"
                >
                  <Camera size={16} className="text-sky-600 group-hover:scale-110 transition-transform" />
                  <span>Prendre une photo pour valider</span>
                  <Sparkles size={13} className="text-amber-500 animate-pulse ml-0.5" />
                </button>
              )}

              {/* MISSION CHRONO — flux entièrement manuel (géofence = bonus).
                  3 états : en cours → arrêt+validation → ou démarrage. */}
              {location.category === 'Missions' && !isCompleted && !isAnalyzing && (
                <div className="col-span-1 sm:col-span-2 flex flex-col gap-2">
                  {isCurrentRunActive ? (
                    /* EN COURS : chrono visible + arrêt manuel (+ abandon). */
                    <div className="flex flex-col gap-2 p-3 bg-red-50 border border-red-250 rounded-2xl items-center text-center">
                      <div className="text-[10px] font-mono text-red-700 font-bold uppercase tracking-wider animate-pulse">
                        ⚠️ CHRONO EN COURS
                      </div>
                      <div className="text-2xl font-black text-red-650 font-mono tracking-wider">
                        {formatTime(elapsedTime)}
                      </div>
                      <button
                        onClick={stopMissionForValidation}
                        className="w-full mt-1.5 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-black uppercase tracking-wide transition-all active:scale-95 cursor-pointer shadow-md"
                      >
                        <Square size={13} fill="currentColor" />
                        <span>Arrêter le chrono</span>
                      </button>
                      <button
                        onClick={onStopRun}
                        className="text-[10px] font-mono text-zinc-500 hover:text-zinc-700 underline underline-offset-2 cursor-pointer"
                      >
                        Abandonner (sans valider)
                      </button>
                    </div>
                  ) : pendingTime !== null ? (
                    /* TEMPS FIGÉ : confirmation « Valider ce temps ? » → photo. */
                    <div className="flex flex-col gap-2 p-3 bg-amber-50 border border-amber-300 rounded-2xl items-center text-center">
                      <div className="text-[10px] font-mono text-amber-700 font-bold uppercase tracking-wider">
                        Temps figé · Valider ce temps ?
                      </div>
                      <div className="text-2xl font-black text-amber-800 font-mono tracking-wider">
                        {pendingTime}
                      </div>
                      <button
                        onClick={() => missionPhotoInputRef.current?.click()}
                        className="w-full mt-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black uppercase tracking-wide transition-all active:scale-95 cursor-pointer shadow-md"
                      >
                        <Camera size={15} />
                        <span>Valider + prendre la photo</span>
                      </button>
                      <button
                        onClick={() => setPendingTime(null)}
                        className="text-[10px] font-mono text-zinc-500 hover:text-zinc-700 underline underline-offset-2 cursor-pointer"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    /* PRÊT : démarrage manuel. */
                    <button
                      onClick={() => onStartRun(location.id)}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-sm font-black tracking-wide uppercase transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <Play size={15} fill="currentColor" />
                      <span>Démarrer le chrono</span>
                    </button>
                  )}
                </div>
              )}

              {/* Completed Status Showcase */}
              {isCompleted && (
                <div className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-550 text-xs font-bold col-span-1 sm:col-span-2 select-none">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Mission résolue de manière permanente</span>
                </div>
              )}

              {/* Optional Center Map Button */}
              {onCenterOnMap && !isAnalyzing && (
                <button
                  onClick={() => onCenterOnMap(location)}
                  className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-zinc-250 bg-white hover:bg-zinc-50 text-zinc-800 text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-95 shadow-sm"
                >
                  <MapPin size={16} className="text-zinc-600" />
                  <span>Centrer sur la carte</span>
                </button>
              )}

              {/* 📸 Photo ici — capture "ambiance" libre (sans géofence) sur les POI
                  NON complétables (ravito/beach club/restos/bars) → collection IndexedDB.
                  Les Plages valident désormais par photo (bouton ci-dessus), comme les
                  Escapades → elles ne sont plus dans la capture libre. */}
              {!isAnalyzing && onCaptureSpotPhoto &&
                ['Ravitaillement', 'Beach Club', 'Restaurants', 'Bars'].includes(location.category) && (
                <>
                  <button
                    onClick={() => ambianceInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-white text-sm font-bold transition-all duration-200 shadow-lg cursor-pointer active:scale-95 sm:col-span-2"
                    style={{ backgroundColor: catInfo.accentColor, boxShadow: `0 4px 14px ${catInfo.accentColor}40` }}
                  >
                    <Camera size={16} />
                    <span>📸 Photo ici</span>
                  </button>
                  <input
                    ref={ambianceInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleAmbianceUpload}
                    className="hidden"
                  />
                </>
              )}

              {/* Liens externes officiels — Restaurants / Beach Club / QG (hôtel).
                  Rangée d'icônes : chaque bouton n'apparaît que si l'URL existe ;
                  la rangée entière disparaît si aucun lien. */}
              {!isAnalyzing && (location.website || location.instagram || location.tiktok) && (
                <div className="sm:col-span-2 flex items-center gap-2.5">
                  {location.website && (
                    <a
                      href={location.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Site web"
                      title="Site web"
                      className={socialBtnClass}
                      style={socialBtnStyle}
                    >
                      <Globe size={18} />
                    </a>
                  )}
                  {location.instagram && (
                    <a
                      href={location.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram"
                      title="Instagram"
                      className={socialBtnClass}
                      style={socialBtnStyle}
                    >
                      <Instagram size={18} />
                    </a>
                  )}
                  {location.tiktok && (
                    <a
                      href={location.tiktok}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="TikTok"
                      title="TikTok"
                      className={socialBtnClass}
                      style={socialBtnStyle}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M16.5 3c.26 2.07 1.42 3.31 3.43 3.44v2.4c-1.17.11-2.19-.27-3.38-.99v5.8c0 3.64-2.5 5.95-5.7 5.95-2.98 0-5.35-2.2-5.35-5.18 0-3.24 2.66-5.42 6.07-4.96v2.64c-.4-.13-.83-.2-1.27-.2-1.4 0-2.42 1-2.42 2.4 0 1.48 1.1 2.5 2.6 2.5 1.55 0 2.62-1.1 2.62-3.02V3h3.37z" />
                      </svg>
                    </a>
                  )}
                </div>
              )}

              {/* Share Button */}
              {!isAnalyzing && (
                <button
                  onClick={shareLocation}
                  className="sm:hidden flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-95 shadow-sm"
                >
                  <Share2 size={16} className="text-zinc-600" />
                  <span>Partager</span>
                </button>
              )}

              {/* Lancer Itinéraire Button */}
              {!isAnalyzing && (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onLaunchNavigation?.()}
                  className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-zinc-950 hover:bg-zinc-900 text-white text-sm font-bold transition-all duration-200 shadow-lg cursor-pointer col-span-1 sm:col-span-1 active:scale-95 text-center"
                  style={{
                    boxShadow: `0 4px 14px ${catInfo.accentColor}25`
                  }}
                >
                  <Navigation size={15} fill="currentColor" />
                  <span>Lancer l'itinéraire</span>
                  <ExternalLink size={13} className="opacity-60" />
                </a>
              )}

            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
