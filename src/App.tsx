/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LocationItem } from './types';
import { INITIAL_LOCATIONS } from './locationsData';
import { courses, CourseData } from './data/coursesData';
import { FilterGroup, ALL_GROUP_IDS, isCategoryVisible } from './filterGroups';
import QuickFilterBar from './components/QuickFilterBar';
import MapFilterBar from './components/MapFilterBar';
import MapContainer from './components/MapContainer';
import { haversineKm, GEOFENCE_KM } from './utils/helper';
import LocationsList from './components/LocationsList';
import BottomSheet from './components/BottomSheet';
import CoverQuest from './components/CoverQuest';
import CoursePhotoPrompt from './components/CoursePhotoPrompt';
import SplashScreen from './components/SplashScreen';
import DenzelMessage from './components/DenzelMessage';
import TutorialOverlay from './components/TutorialOverlay';
import { approachRadiusKm, isPhotoSlot, shortLabel } from './coverData';
import {
  getDenzelAmbient,
  getDenzelReopenPrompt,
  getDenzelChronoPrompt,
  getDenzelSpotPhotoLine,
  denzelTutorial,
  denzelWalletMessage,
  DenzelLine,
  PanelKey,
} from './data/denzelMessages';
import {
  Compass,
  Map as MapIcon,
  Trophy,
  X,
} from 'lucide-react';
import {
  migrateLegacyKeys,
  safeLocalStorage,
  loadCoursePhotos, putCoursePhoto,
  loadSpotPhotos, putSpotPhoto,
  loadCapturedPhotos, putCapturedPhoto,
  loadFreePhotos, putFreePhoto, deleteFreePhoto,
  loadGtaPhotos, putGtaPhoto,
} from './utils/storage';
import { buildPhotoCollection } from './utils/photoCollection';

// Renomme les clés héritées « tenirife_* » → « tenerife_* » une fois, AVANT que
// les initialiseurs d'état (ci-dessous) ne lisent les nouvelles clés.
migrateLegacyKeys();

// Rayons des courses (km) : approche ANTICIPÉE large (on roule jusqu'au départ →
// signal précoce 'soft'), puis RENFORT 'strong' à 1 km. Complémentaire du
// CoursePhotoPrompt (action sur place à 50 m).
const COURSE_APPROACH_KM = 5;
const COURSE_REINFORCE_KM = 1;

export default function App() {
  // --- CORE GAMEPLAY STATE ---
  // Shared filter state: which groups are currently visible (multi-select).
  // Single source of truth for the map overlay, the spot bar and the spot list.
  // Défaut : AUCUN filtre actif (carte vierge à l'ouverture). Le choix reste en
  // mémoire pendant la session ; on active manuellement.
  const [activeGroups, setActiveGroups] = useState<FilterGroup[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);
  // Selected race (course). Mutually exclusive with selectedLocation — opening
  // one closes the other so a single bottom sheet is shown at a time.
  const [selectedCourse, setSelectedCourse] = useState<CourseData | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  // Persistence state
  const [completedLocationIds, setCompletedLocationIds] = useState<number[]>(() => {
    try {
      const saved = safeLocalStorage.getItem('tenerife_completed_locations');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Escapades photos now live in IndexedDB (1280 px originals would blow the
  // localStorage quota). Hydrated on mount via loadCapturedPhotos() (which also
  // migrates the legacy localStorage blob once).
  const [capturedPhotos, setCapturedPhotos] = useState<Record<number, string>>({});

  const [completedTimes, setCompletedTimes] = useState<Record<number, string>>(() => {
    try {
      const saved = safeLocalStorage.getItem('tenerife_completed_times');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Spots « visités » = spots à lien (Bars / Restaurants / Beach Club / QG…) dont
  // un lien (site / insta / tiktok) a été ouvert ≥ 1 fois. Signal PLUS LÉGER que la
  // vraie validation (completedLocationIds). Persisté en localStorage.
  const [visitedSpotIds, setVisitedSpotIds] = useState<number[]>(() => {
    try {
      const saved = safeLocalStorage.getItem('tenerife_visited_spots');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const handleVisitSpot = useCallback((locId: number) => {
    setVisitedSpotIds((prev) => {
      if (prev.includes(locId)) return prev;
      const next = [...prev, locId];
      safeLocalStorage.setItem('tenerife_visited_spots', JSON.stringify(next));
      return next;
    });
  }, []);

  // Course (race) completion — dedicated state keyed by the course's string id,
  // separate from the spot completion above. Courses do NOT feed the spot 100%
  // / Social Club; the prologue (tutorial:true) is excluded from any course tally.
  const [completedCourseIds, setCompletedCourseIds] = useState<string[]>(() => {
    try {
      const saved = safeLocalStorage.getItem('tenerife_completed_courses');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Course photos live in IndexedDB (base64 too heavy for the localStorage
  // quota). Hydrated asynchronously on mount via loadCoursePhotos(), then shown
  // in the Social Club "Courses" gallery (CoverQuest).
  const [coursePhotos, setCoursePhotos] = useState<Record<string, string>>({});

  // "Ambiance" photos taken freely on POI spots (beach clubs/restos/ravito/bars/
  // plages) — IndexedDB, keyed by spot id. Joins the Social Club + jaquette pool.
  const [spotPhotos, setSpotPhotos] = useState<Record<number, string>>({});

  // PERSO photos added freely from the Social Club (not tied to any mission) —
  // IndexedDB, keyed by a stable uuid. Supplémentaires, non décomptées.
  const [freePhotos, setFreePhotos] = useState<Record<string, string>>({});

  // GTA-styled versions (IndexedDB), keyed by composite key (course:<id> /
  // loc:<id>). The original is never overwritten; display prefers the GTA one.
  const [gtaPhotos, setGtaPhotos] = useState<Record<string, string>>({});
  // Transient styling status per key: 'pending' (in flight/queued) | 'error'.
  // Not persisted — re-derived from "has an original but no GTA" on reload.
  const [gtaStatus, setGtaStatus] = useState<Record<string, 'pending' | 'error'>>({});

  // El Jefe info-bulle shown when within 50 m of a course's photo point.
  const [coursePhotoPrompt, setCoursePhotoPrompt] = useState<CourseData | null>(null);

  // Persistance du stockage (iOS/Safari peut purger IndexedDB après ~7 j d'inactivité).
  // Bandeau discret affiché seulement si la persistance est refusée/indispo.
  const [showStorageBanner, setShowStorageBanner] = useState(false);
  const persistCheckedRef = useRef(false);
  // Passe à true au PREMIER geste utilisateur. iOS (surtout en PWA standalone)
  // déclenche la géoloc/persistance de façon fiable après un tap → on gate dessus.
  const [interacted, setInteracted] = useState(false);

  // Hydrate IndexedDB photo stores once on mount (course photos also migrate any
  // old localStorage blob the first time).
  useEffect(() => {
    loadCoursePhotos().then(setCoursePhotos).catch(() => {});
    loadSpotPhotos().then(setSpotPhotos).catch(() => {});
    loadCapturedPhotos().then(setCapturedPhotos).catch(() => {});
    loadFreePhotos().then(setFreePhotos).catch(() => {});
    loadGtaPhotos().then(setGtaPhotos).catch(() => {});
  }, []);

  // ── GTA styling queue ──────────────────────────────────────────────────────
  // Each captured ORIGINAL is POSTed to the serverless proxy in the background;
  // the styled result is stored (gta_photos) and the display switches to it. The
  // original is kept intact. Sequential queue, retry-on-failure, offline-aware.
  const gtaQueueRef = useRef<Array<{ key: string; original: string }>>([]);
  const gtaRunningRef = useRef(false);
  const gtaInflightRef = useRef<Set<string>>(new Set());
  // Clés stylisées avec SUCCÈS, marquées de façon SYNCHRONE. setGtaPhotos est une
  // MAJ d'état asynchrone : entre le retrait de gtaInflightRef et le commit de
  // gtaPhotos, l'auto-enqueue verrait gtaPhotos[key] encore vide → ré-ajout =
  // double appel proxy (double facturation). Ce ref ferme cette fenêtre.
  const gtaDoneRef = useRef<Set<string>>(new Set());

  const postGtaify = async (original: string): Promise<string> => {
    const data = original.includes(',') ? original.split(',')[1] : original;
    const res = await fetch('/api/gtaify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: data }),
    });
    if (!res.ok) throw new Error(`gtaify ${res.status}`);
    const json = await res.json();
    if (!json?.image) throw new Error('no_image');
    return `data:image/jpeg;base64,${json.image}`;
  };

  const drainGtaQueue = async () => {
    if (gtaRunningRef.current) return;
    gtaRunningRef.current = true;
    try {
      while (gtaQueueRef.current.length) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) break; // offline → pause
        const job = gtaQueueRef.current.shift();
        if (!job) break;
        gtaInflightRef.current.add(job.key);
        setGtaStatus((s) => ({ ...s, [job.key]: 'pending' }));
        try {
          const styled = await postGtaify(job.original);
          await putGtaPhoto(job.key, styled);
          // Marque "completed" AVANT de libérer gtaInflightRef (plus bas), pour que
          // l'auto-enqueue ne puisse pas ré-ajouter la clé tant que gtaPhotos n'a
          // pas commité son nouvel état.
          gtaDoneRef.current.add(job.key);
          setGtaPhotos((p) => ({ ...p, [job.key]: styled }));
          setGtaStatus((s) => { const n = { ...s }; delete n[job.key]; return n; });
        } catch {
          setGtaStatus((s) => ({ ...s, [job.key]: 'error' }));
        } finally {
          gtaInflightRef.current.delete(job.key);
        }
      }
    } finally {
      gtaRunningRef.current = false;
    }
  };

  const enqueueGta = (key: string, original: string, force = false) => {
    if (!original) return;
    // already styled — gtaPhotos (état) OU gtaDoneRef (marqueur synchrone, comble
    // la fenêtre avant le commit de gtaPhotos).
    if (!force && (gtaPhotos[key] || gtaDoneRef.current.has(key))) return;
    if (gtaInflightRef.current.has(key)) return;                 // in flight
    if (gtaQueueRef.current.some((j) => j.key === key)) return;  // already queued
    gtaQueueRef.current.push({ key, original });
    setGtaStatus((s) => ({ ...s, [key]: 'pending' }));
    void drainGtaQueue();
  };

  // Auto-enqueue every original that still lacks a GTA version (mount once
  // hydrated, after each new capture, and after each success). Same merge source
  // as the gallery.
  useEffect(() => {
    const entries = buildPhotoCollection(coursePhotos, capturedPhotos, spotPhotos, freePhotos);
    for (const e of entries) {
      if (!gtaPhotos[e.key]) enqueueGta(e.key, e.original);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coursePhotos, capturedPhotos, spotPhotos, freePhotos, gtaPhotos]);

  // Resume the queue when connectivity returns (offline → reste sur l'original).
  useEffect(() => {
    const onOnline = () => void drainGtaQueue();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manual "régénérer" — force a fresh proxy call for one photo (keeps original).
  const regenerateGta = (key: string) => {
    const entry = buildPhotoCollection(coursePhotos, capturedPhotos, spotPhotos, freePhotos).find((e) => e.key === key);
    if (entry) enqueueGta(key, entry.original, true);
  };

  // Photos perso ajoutées depuis le Social Club (déjà compressées ~1280 px).
  const handleAddFreePhoto = (base64: string) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setFreePhotos((prev) => ({ ...prev, [id]: base64 }));
    void putFreePhoto(id, base64); // la file de stylisation l'enverra au proxy
  };

  // Suppression d'une photo perso : retire l'original ET sa version GTA.
  const handleDeleteFreePhoto = (id: string) => {
    setFreePhotos((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setGtaPhotos((prev) => { const n = { ...prev }; delete n[`free:${id}`]; return n; });
    gtaDoneRef.current.delete(`free:${id}`); // symétrie : libère le marqueur "completed"
    void deleteFreePhoto(id);
  };

  // DEV flag — gates the geofence simulator (kept for a full dry-run before the
  // trip). Enable with ?dev=1 (persisted), disable with ?dev=0; else localStorage.
  const devMode = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('dev') === '1') { safeLocalStorage.setItem('dev', '1'); return true; }
      if (params.get('dev') === '0') { safeLocalStorage.removeItem('dev'); return false; }
      return safeLocalStorage.getItem('dev') === '1';
    } catch {
      return false;
    }
  }, []);

  // UI state
  const [showSplash, setShowSplash] = useState(true);
  // First-run Denzel tutorial — shown once (persisted via "tutorialSeen").
  const [showTutorial, setShowTutorial] = useState<boolean>(() => {
    try {
      return safeLocalStorage.getItem('tutorialSeen') !== 'true';
    } catch (e) {
      return true;
    }
  });
  const finishTutorial = useCallback(() => {
    setShowTutorial(false);
    try {
      safeLocalStorage.setItem('tutorialSeen', 'true');
    } catch (e) {
      /* best-effort */
    }
  }, []);
  // Stable ref so re-renders during the splash (e.g. GPS updates) don't restart
  // the splash timer — otherwise the splash could extend or stick indefinitely.
  const handleSplashComplete = useCallback(() => setShowSplash(false), []);

  // Denzel Sag — narrator handler messages (src/data/denzelMessages).
  const [denzelMessage, setDenzelMessage] = useState<DenzelLine | null>(null);
  const ambientFiredRef = useRef(false);
  // Set when the player launches navigation; the reopen prompt fires only when
  // they actually come BACK to the app (visibilitychange), not at launch.
  const pendingReopenRef = useRef(false);

  const [showGtaOverlay, setShowGtaOverlay] = useState(false);
  const [completedMissionName, setCompletedMissionName] = useState('');
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'trophies'>('map');

  // Theme (Manrique/Vice design tokens — see src/styles/tokens.css)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = safeLocalStorage.getItem('isla_theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch (e) {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      safeLocalStorage.setItem('isla_theme', theme);
    } catch (e) {
      /* persistence best-effort */
    }
  }, [theme]);
  
  // Custom HUD states
  const [activeRunLocationId, setActiveRunLocationId] = useState<number | null>(null);
  // Course chrono run (string id) — parallel to the legacy mission run above.
  // Only one run (mission OR course) is ever active at a time.
  const [activeRunCourseId, setActiveRunCourseId] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const stopwatchIntervalRef = useRef<any>(null);
  // Mirror of elapsedTime read by the geofence effect, so that effect does not
  // need elapsedTime in its deps (which would re-subscribe watchPosition ~30x/s).
  const elapsedTimeRef = useRef<number>(0);

  // Cover Quest — camera overlay for the currently-targeted cover slot
  // Slots we've already pinged for proximity (fire-once until the player leaves).
  const approachAlertedRef = useRef<Set<number>>(new Set());
  // Courses whose 50 m photo prompt has already fired (re-armed on leaving).
  const coursePromptAlertedRef = useRef<Set<string>>(new Set());

  // On app open (once the splash is gone), if no mission is running, greet the
  // player with an ambient Denzel line — but at most once every 30 min (persisted).
  // The cooldown only gates the AMBIENT line; action messages always fire.
  useEffect(() => {
    // Wait until both the splash and the first-run tutorial are dismissed.
    if (!showSplash && !showTutorial && !ambientFiredRef.current) {
      // Un run actif masque l'ambient : on NE marque PAS firedRef ici, sinon il ne
      // reviendrait jamais. activeRunLocationId est dans les deps → quand le run se
      // termine, l'effet ré-évalue et l'ambient peut enfin s'afficher.
      if (activeRunLocationId !== null) return;

      const COOLDOWN_MS = 30 * 60 * 1000;
      const last = Number(safeLocalStorage.getItem('tenerife_denzel_ambient_ts')) || 0;
      if (Date.now() - last >= COOLDOWN_MS) {
        // Marqué seulement quand le message s'affiche vraiment.
        ambientFiredRef.current = true;
        setDenzelMessage(getDenzelAmbient());
        safeLocalStorage.setItem('tenerife_denzel_ambient_ts', String(Date.now()));
      }
    }
  }, [showSplash, showTutorial, activeRunLocationId]);

  // When the player returns to the app AFTER launching navigation, Denzel greets
  // them back ("you're on site"). Gated by pendingReopenRef so a plain tab switch
  // doesn't trigger it.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && pendingReopenRef.current) {
        pendingReopenRef.current = false;
        setDenzelMessage(getDenzelReopenPrompt());
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Demande la persistance du stockage (empêche iOS/Safari de purger IndexedDB).
  // Doit suivre un geste utilisateur. Une seule tentative par session ; mémorisé en
  // localStorage pour ne PAS redemander en boucle. Si refusé/indispo → bandeau.
  const ensurePersistentStorage = async () => {
    if (persistCheckedRef.current) return;
    persistCheckedRef.current = true;
    const state = safeLocalStorage.getItem('tenerife_persist');
    if (state === 'granted' || state === 'dismissed') return; // déjà réglé → on ne redemande pas
    try {
      const sm = navigator.storage;
      if (sm && typeof sm.persist === 'function') {
        const already = typeof sm.persisted === 'function' ? await sm.persisted() : false;
        if (already || (await sm.persist())) {
          safeLocalStorage.setItem('tenerife_persist', 'granted');
          return;
        }
      }
      setShowStorageBanner(true); // refusé ou API indispo → bandeau non bloquant
    } catch {
      /* best-effort */
    }
  };

  // Premier geste utilisateur dans l'app → marque `interacted` (débloque la géoloc)
  // et tente la persistance (une fois). iOS exige un geste pour ces permissions.
  useEffect(() => {
    const onFirstGesture = () => { setInteracted(true); void ensurePersistentStorage(); };
    window.addEventListener('pointerdown', onFirstGesture, { once: true });
    return () => window.removeEventListener('pointerdown', onFirstGesture);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissStorageBanner = () => {
    setShowStorageBanner(false);
    safeLocalStorage.setItem('tenerife_persist', 'dismissed'); // ne plus afficher
  };

  const allLocations = useMemo(() => {
    return INITIAL_LOCATIONS;
  }, []);

  // Filter chips toggle group visibility (multi-select). Seules les entrées
  // trophées (id 101-105) sont exclues des pins/liste. Les Missions sont à NOUVEAU
  // visibles (sous le chip « Missions », à côté des courses) → tap → bottom sheet →
  // chrono manuel (le géofence reste un déclencheur bonus).
  const visibleLocations = useMemo(() => {
    return allLocations
      .filter((loc) => !loc.category.startsWith('🏆'))
      .filter((loc) => isCategoryVisible(loc.category, activeGroups));
  }, [allLocations, activeGroups]);

  // Pulse de proximité — RÉUTILISE la logique d'approche existante (haversineKm +
  // approachRadiusKm, la même qui déclenche la notif El Jefe). 'strong' dans le
  // rayon d'action (50 m), 'soft' dans l'approche large. Un spot complété ne pulse
  // plus. Recalculé à chaque fix GPS (userCoords).
  const pulseLevels = useMemo<Record<number, 'soft' | 'strong'>>(() => {
    const out: Record<number, 'soft' | 'strong'> = {};
    if (!userCoords) return out;
    for (const loc of allLocations) {
      if (loc.category.startsWith('🏆')) continue;
      if (completedLocationIds.includes(loc.id)) continue;
      if (visitedSpotIds.includes(loc.id)) continue; // visité = fait (léger) → ne pulse plus
      const d = haversineKm(userCoords.lat, userCoords.lng, loc.lat, loc.lng);
      if (d <= approachRadiusKm(loc.category)) out[loc.id] = d <= GEOFENCE_KM ? 'strong' : 'soft';
    }
    return out;
  }, [userCoords, allLocations, completedLocationIds, visitedSpotIds]);

  // Pulse de proximité des COURSES (pin depart) — MÊME mécanisme (haversineKm vers le
  // départ). Approche ANTICIPÉE large (5 km : on roule jusqu'au spot, signal précoce),
  // 'strong' dans le rayon d'action (GEOFENCE_KM 50 m). Une course dont le run est fait
  // ne pulse plus. Complémentaire du CoursePhotoPrompt (action sur place).
  const coursePulseLevels = useMemo<Record<string, 'soft' | 'strong'>>(() => {
    const out: Record<string, 'soft' | 'strong'> = {};
    if (!userCoords) return out;
    for (const c of courses) {
      if (completedCourseIds.includes(c.id)) continue;
      const d = haversineKm(userCoords.lat, userCoords.lng, c.start.lat, c.start.lng);
      if (d <= COURSE_APPROACH_KM) out[c.id] = d <= COURSE_REINFORCE_KM ? 'strong' : 'soft';
    }
    return out;
  }, [userCoords, completedCourseIds]);

  // PROXIMITÉ > FILTRE : un spot en approche s'affiche TOUJOURS, même si sa
  // catégorie est masquée par le filtre (qui ne sert qu'à parcourir).
  // `nearbyKey` = signature STABLE (ids triés) de l'ensemble en approche → évite de
  // reconstruire tous les marqueurs à chaque fix GPS quand l'ensemble ne bouge pas
  // (le niveau soft/strong, lui, est appliqué côté carte par un simple toggle de classe).
  const nearbyKey = Object.keys(pulseLevels).map(Number).sort((a, b) => a - b).join(',');
  const mapLocations = useMemo(() => {
    const byId = new Map<number, LocationItem>();
    for (const loc of visibleLocations) byId.set(loc.id, loc);
    for (const idStr of nearbyKey ? nearbyKey.split(',') : []) {
      const id = Number(idStr);
      if (!byId.has(id)) {
        const loc = allLocations.find((l) => l.id === id);
        if (loc) byId.set(id, loc);
      }
    }
    return [...byId.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLocations, nearbyKey, allLocations]);

  const toggleGroup = useCallback((group: FilterGroup) => {
    setActiveGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  }, []);

  // « Tous » bascule : si tout est déjà actif → tout désactiver, sinon tout activer.
  const selectAllGroups = useCallback(
    () => setActiveGroups((prev) => (prev.length === ALL_GROUP_IDS.length ? [] : ALL_GROUP_IDS)),
    [],
  );

  // The Missions chip drives the course layer: pins show when it is active;
  // routes are revealed only when it is isolated (focused) or a course is tapped.
  const coursesActive = activeGroups.includes('Missions');
  const coursesFocused = activeGroups.length === 1 && activeGroups[0] === 'Missions';
  // Pin labels (tooltips) only show when a SINGLE filter group is isolated —
  // with several (or all) groups on, labels overlap (esp. around the QG), so we
  // hide them and keep pins only.
  const singleGroupActive = activeGroups.length === 1;

  // Open a race sheet (and close any spot sheet — one at a time).
  const handleSelectCourse = useCallback((course: CourseData) => {
    setSelectedLocation(null);
    setSelectedCourse(course);
  }, []);

  // Keep the spot selection consistent with the filters: if the open spot's
  // group gets hidden, close it. Trophy selections (fly-to targets) are exempt.
  useEffect(() => {
    if (
      selectedLocation &&
      !selectedLocation.category.startsWith('🏆') &&
      !isCategoryVisible(selectedLocation.category, activeGroups)
    ) {
      setSelectedLocation(null);
    }
  }, [activeGroups, selectedLocation]);

  // Spots that surface a geofenced "you're approaching" toast (Escapades photo
  // ritual + the legacy Missions/Plages proximity). No global completion score
  // is derived from this any more — the Social Club tracks per-type counters.
  const completableLocations = useMemo(
    () => allLocations.filter(
      (l) => l.category === 'Missions' || l.category === 'Escapades' || l.category === 'Plages'
    ),
    [allLocations]
  );

  // Single shared AudioContext, lazily created on first sound. Browsers cap the
  // number of live contexts (~6), so creating one per chime eventually goes silent.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const getAudioContext = (): AudioContext | null => {
    try {
      if (!audioCtxRef.current) {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return null;
        audioCtxRef.current = new Ctor();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch (e) {
      return null;
    }
  };

  // Synthesis engine: Celebratory retro 8-bit sound chime (Zero API dependency)
  const playSuccessChime = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const freqs = [392.00, 523.25, 659.25, 783.99, 1046.50]; // G4 - C5 - E5 - G5 - C6
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.12, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.4);
      });
    } catch (e) {
      console.warn("Chime AudioContext error:", e);
    }
  };

  // SMS chirp sound
  const playSmsChirp = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.setValueAtTime(880.00, now + 0.08); // A5
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);
    } catch (e) {}
  };

  // Ask for OS notification permission (must follow a user gesture on iOS).
  const ensureNotifPermission = () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

  // Surface an OS-level notification (real banner, even if the tab is backgrounded
  // while the app stays open). NOTE: a PWA cannot geofence in the background — the
  // GPS watch only runs while the app is foreground — so this fires from the live
  // watchPosition, not from a closed app. The in-app toast remains the fallback.
  const notifyOS = async (title: string, body: string, tag: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          reg.showNotification(title, { body, tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' });
          return;
        }
      }
      new Notification(title, { body, tag, icon: '/icons/icon-192.png' });
    } catch (e) {
      /* notifications best-effort */
    }
  };

  // Shared stopwatch engine (one timer; mission run OR course run uses it).
  const startStopwatch = () => {
    setElapsedTime(0);
    elapsedTimeRef.current = 0;
    startTimeRef.current = Date.now();
    if (stopwatchIntervalRef.current) clearInterval(stopwatchIntervalRef.current);
    stopwatchIntervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const ms = Date.now() - startTimeRef.current;
        elapsedTimeRef.current = ms;
        setElapsedTime(ms);
      }
    }, 33);
  };

  const stopStopwatch = () => {
    if (stopwatchIntervalRef.current) {
      clearInterval(stopwatchIntervalRef.current);
      stopwatchIntervalRef.current = null;
    }
    startTimeRef.current = null;
    elapsedTimeRef.current = 0;
    setElapsedTime(0);
  };

  // Run stopwatch controls (legacy Mission spots — pins are hidden now, so in
  // practice the active run is a course; kept for completeness).
  const handleStartRun = (locId: number) => {
    setDenzelMessage(getDenzelChronoPrompt());
    setActiveRunCourseId(null); // only one run at a time
    setActiveRunLocationId(locId);
    startStopwatch();
  };

  const handleStopRun = () => {
    stopStopwatch();
    setActiveRunLocationId(null);
  };

  // Course chrono run — ported from the mission chrono. Starts at the depart;
  // auto-stops at the 50 m arrival geofence (watchPosition). "Run done" lands in
  // completedCourseIds; the course PHOTO is an INDEPENDENT state (coursePhotos).
  const handleStartCourseRun = (course: CourseData) => {
    setSelectedCourse(null);      // close the sheet → run HUD unobstructed
    setActiveRunLocationId(null); // only one run at a time
    setDenzelMessage(getDenzelChronoPrompt());
    setActiveRunCourseId(course.id);
    startStopwatch();
  };

  const handleStopCourseRun = () => {
    stopStopwatch();
    setActiveRunCourseId(null);
  };

  const markCourseRunDone = (course: CourseData) => {
    if (completedCourseIds.includes(course.id)) return;
    const nextDone = [...completedCourseIds, course.id];
    setCompletedCourseIds(nextDone);
    safeLocalStorage.setItem('tenerife_completed_courses', JSON.stringify(nextDone));
  };

  const handleSavePhotoSouvenir = (locId: number, base64: string) => {
    setCapturedPhotos((prev) => ({ ...prev, [locId]: base64 }));
    void putCapturedPhoto(locId, base64); // IndexedDB (originaux 1280 px)
  };

  // Capture committed from the El Jefe info-bulle: persist the PHOTO only. The
  // course's completion (its run/chrono) is a SEPARATE state — taking the photo
  // no longer marks the course done. The shot just joins the Social Club + pool.
  const handleCaptureCoursePhoto = (course: CourseData, base64: string) => {
    setCoursePhotos((prev) => ({ ...prev, [course.id]: base64 }));
    // Heavy base64 → IndexedDB, never localStorage (quota). Fire-and-forget.
    void putCoursePhoto(course.id, base64);

    setCoursePhotoPrompt(null);
    setDenzelMessage({ text: `Beau cliché. « ${course.title} » rejoint ta collection.`, panel: 'happy' });
  };

  // Ambiance photo committed from a spot's "📸 Photo ici" action. No geofence
  // (she's there). Persists to IndexedDB → Social Club + jaquette pool. NOT
  // counted in any X/Y tally — it's a free, extra souvenir.
  const handleCaptureSpotPhoto = (locId: number, base64: string) => {
    setSpotPhotos((prev) => ({ ...prev, [locId]: base64 }));
    void putSpotPhoto(locId, base64);
    setDenzelMessage(getDenzelSpotPhotoLine(locId));
  };

  // Trigger game rewards
  const handleCompleteLocation = (location: LocationItem, finishTime?: string) => {
    if (completedLocationIds.includes(location.id)) return;
    const nextCompleted = [...completedLocationIds, location.id];
    setCompletedLocationIds(nextCompleted);
    safeLocalStorage.setItem('tenerife_completed_locations', JSON.stringify(nextCompleted));

    if (finishTime) {
      const nextTimes = { ...completedTimes, [location.id]: finishTime };
      setCompletedTimes(nextTimes);
      safeLocalStorage.setItem('tenerife_completed_times', JSON.stringify(nextTimes));
    }

    // Play retro chime & trigger cinematic overlay
    playSuccessChime();
    setCompletedMissionName(location.name);
    setShowGtaOverlay(true);

    // Event-driven narration from El Jefe (shown in the panel bubble).
    let smsText = "Objectif validé. Le QG valide le transfert des fonds. Continue comme ça.";
    let panel: PanelKey = 'happy';
    if (location.id === 8) {
      smsText = "Propre. La spéciale de Teno est pliée et le Stelvio n'a pas une égratignure. On passe à la suite.";
      panel = 'car';
    } else if (location.id === 7) {
      smsText = "Tu as dompté le volcan. Le grip noir n'a plus de secret pour toi. Joli run.";
      panel = 'teide';
    } else if (location.id === 9) {
      smsText = "Maître du Flow débloqué. Même sous la canopée glissante, la trajectoire était parfaite.";
      panel = 'car';
    }

    setDenzelMessage({ text: smsText, panel });
    playSmsChirp();
  };

  // Geofence processing — the SAME checks run for a live GPS fix AND for the DEV
  // simulator below, so "simulate arrival" exercises the real flow (not a mock).
  const applyGeofence = (userLat: number, userLng: number) => {
    const computeDistance = (lat1: number, lng1: number, lat2: number, lng2: number) =>
      haversineKm(lat1, lng1, lat2, lng2);

    // Mission completion = crossing the 50 m chrono finish line (legacy spots —
    // pins hidden now, kept for completeness).
    if (activeRunLocationId !== null) {
      const runTarget = allLocations.find((l) => l.id === activeRunLocationId);
      if (runTarget) {
        const currentDist = computeDistance(userLat, userLng, runTarget.lat, runTarget.lng);
        if (currentDist <= 0.050) {
          const formatTime = (ms: number) => {
            const totalSec = Math.floor(ms / 1000);
            const m = Math.floor(totalSec / 60);
            const s = totalSec % 60;
            const h = Math.floor((ms % 1000) / 10);
            return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${h.toString().padStart(2, '0')}`;
          };
          const finishScore = formatTime(elapsedTimeRef.current);
          handleCompleteLocation(runTarget, finishScore);
          handleStopRun();
        }
      }
    }

    // Course run completion = crossing the 50 m line at the ARRIVAL. Marks the
    // run done (a state SEPARATE from the course photo).
    if (activeRunCourseId !== null) {
      const runCourse = courses.find((c) => c.id === activeRunCourseId);
      if (runCourse) {
        const d = computeDistance(userLat, userLng, runCourse.end.lat, runCourse.end.lng);
        if (d <= 0.050) {
          markCourseRunDone(runCourse);
          handleStopCourseRun();
          setDenzelMessage({ text: `Run bouclé — « ${runCourse.trophy} » décroché.`, panel: 'happy' });
        }
      }
    }

    // Approach notification — ping once when entering an incomplete PHOTO slot's
    // zone : Escapades/Plages (500 m, photo) OU Missions (100 m, chrono). Les
    // Missions sont à nouveau accessibles (pin/fiche) → la notif pointe vers une
    // action réelle. Les vraies courses chrono ont en plus leur propre prompt
    // (courses.forEach + CoursePhotoPrompt).
    completableLocations.forEach((loc) => {
      if (completedLocationIds.includes(loc.id)) return;
      const d = computeDistance(userLat, userLng, loc.lat, loc.lng);
      const radius = approachRadiusKm(loc.category);
      const alerted = approachAlertedRef.current.has(loc.id);
      if (d <= radius && !alerted) {
        approachAlertedRef.current.add(loc.id);
        const label = shortLabel(loc);
        const isPhoto = isPhotoSlot(loc.category);
        const body = isPhoto
          ? `Tu es sur ${label}. Ouvre la fiche du spot et prends ta photo pour valider.`
          : `Tu es sur ${label}. Ouvre la fiche et lance/arrête ton chrono pour valider.`;
        setDenzelMessage({ text: body, panel: isPhoto ? 'corales' : 'car' });
        playSmsChirp();
        void notifyOS(`Zone atteinte · ${label}`, body, `approach_${loc.id}`);
      } else if (alerted && d > radius * 1.6) {
        approachAlertedRef.current.delete(loc.id); // left the zone → re-armable
      }
    });

    // Course photo point — within 50 m of a course's photo point (arrival by
    // default, start when photoAtStart). Fire-once until the player leaves.
    courses.forEach((course) => {
      if (coursePhotos[course.id]) return; // photo already taken (independent of the run)
      const pt = course.photoAtStart ? course.start : course.end;
      const d = computeDistance(userLat, userLng, pt.lat, pt.lng);
      const alerted = coursePromptAlertedRef.current.has(course.id);
      if (d <= 0.050 && !alerted) {
        coursePromptAlertedRef.current.add(course.id);
        setCoursePhotoPrompt(course);
        playSmsChirp();
        void notifyOS(`Spot photo · ${course.title}`, course.visuel, `course_${course.id}`);
      } else if (alerted && d > 0.080) {
        coursePromptAlertedRef.current.delete(course.id); // left → re-armable
      }
    });
  };

  // ─── DEV · TEMP — simulate reaching a geofence without being on site. Calls
  // the REAL applyGeofence at the target coords. Remove once the flow is OK. ───
  const devSimulateArrival = () => {
    let target: { lat: number; lng: number } | null = null;
    if (activeRunCourseId) {
      const c = courses.find((c) => c.id === activeRunCourseId);
      if (c) target = c.end;
    } else if (activeRunLocationId !== null) {
      const l = allLocations.find((l) => l.id === activeRunLocationId);
      if (l) target = { lat: l.lat, lng: l.lng };
    }
    if (!target) return;
    // Re-arm the photo prompt for this course so it can pop again on re-test.
    if (activeRunCourseId) coursePromptAlertedRef.current.delete(activeRunCourseId);
    setUserCoords(target);
    applyGeofence(target.lat, target.lng);
  };

  const devSimulatePhotoSpot = () => {
    const c = selectedCourse ?? courses.find((c) => c.id === activeRunCourseId) ?? null;
    if (!c) return;
    const pt = c.photoAtStart ? c.start : c.end;
    coursePromptAlertedRef.current.delete(c.id); // re-arm so the prompt re-fires
    setUserCoords({ lat: pt.lat, lng: pt.lng });
    applyGeofence(pt.lat, pt.lng);
  };

  // Continuous geofencing watchdog — keeps userCoords fresh + runs the geofence
  // checks. Démarré seulement APRÈS le premier geste utilisateur (iOS exige un
  // tap pour un prompt de géoloc fiable, surtout en PWA standalone).
  useEffect(() => {
    if (!interacted || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        setUserCoords({ lat: userLat, lng: userLng });
        applyGeofence(userLat, userLng);
      },
      (err) => {
        console.warn("Geofence watchPosition telemetry error:", err);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
    // applyGeofence reads live state via closure; deps re-subscribe on the state
    // it needs. elapsedTime read via elapsedTimeRef to avoid ~30x/s churn.
  }, [interacted, completedLocationIds, completedCourseIds, allLocations, activeRunLocationId, activeRunCourseId, coursePhotos]);

  // When a spot is targeted (closes any open race sheet — one sheet at a time).
  const handleSelectLocation = (location: LocationItem) => {
    setSelectedCourse(null);
    setSelectedLocation(location);
    if (activeTab === 'list' || activeTab === 'trophies') {
      setActiveTab('map');
    }
  };

  // Center on map helper
  const handleCenterOnMap = (location: LocationItem) => {
    setSelectedLocation(location);
    setActiveTab('map');
    if (activeTab !== 'map') {
      setActiveTab('map');
    }
  };

  // Formats stopwatch time for visual widget
  const getFormattedElapsedTime = () => {
    const totalSec = Math.floor(elapsedTime / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const h = Math.floor((elapsedTime % 1000) / 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${h.toString().padStart(2, '0')}`;
  };

  return (
    <div className="app-bg relative w-screen h-full overflow-hidden select-none font-sans flex flex-col text-zinc-900">

      {/* BOOT SPLASH — artwork GTA déjà titré, plein cadre (fade out 0.5s) */}
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      </AnimatePresence>

      {/* FIRST-RUN TUTORIAL — Denzel onboarding, shown once (after the splash) */}
      {!showSplash && showTutorial && (
        <TutorialOverlay steps={denzelTutorial} onComplete={finishTutorial} />
      )}

      {/* Le portefeuille vit désormais dans le HUD carte, sous l'avatar d'El Jefe
          (voir MapContainer) ; tap → message d'El Jefe. */}

      {/* 3. Primary Viewboard container (Occupies full viewport so map tiles flow under header) */}
      <main className="absolute inset-0 w-full h-full flex overflow-hidden z-0 bg-slate-950">
        
        {/* DESKTOP SPLIT VIEW: sidebar list (Padded to start below floating glassmorphic header) */}
        <section className={`app-bg hidden md:block w-80 lg:w-96 h-full shrink-0 border-r border-[color:var(--hairline)] pt-12 z-10 transition-all ${activeTab === 'trophies' ? 'opacity-0 select-none pointer-events-none absolute' : ''}`}>
          <div className="flex flex-col h-full">
            {/* Quick Filters blended inside sidebar */}
            <div
              className="py-1 border-b border-[color:var(--hairline)] shadow-md shrink-0"
              style={{
                background: 'color-mix(in srgb, var(--surface) 55%, transparent)',
                backdropFilter: 'blur(var(--blur-glass))',
                WebkitBackdropFilter: 'blur(var(--blur-glass))',
              }}
            >
              <QuickFilterBar
                activeGroups={activeGroups}
                onToggleGroup={toggleGroup}
                onSelectAll={selectAllGroups}
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <LocationsList
                locations={allLocations}
                selectedLocation={selectedLocation}
                activeGroups={activeGroups}
                onSelectLocation={handleSelectLocation}
                userCoords={userCoords}
              />
            </div>
          </div>
        </section>

        {/* MAP STAGE FRAME (re-centers automatically) */}
        <section data-tour="map" className={`flex-1 h-full relative ${activeTab === 'map' ? 'block' : 'hidden md:block'} ${activeTab === 'trophies' ? 'hidden md:hidden' : ''}`}>

          <MapContainer
            locations={mapLocations}
            pulseLevels={pulseLevels}
            coursePulseLevels={coursePulseLevels}
            visitedLocations={visitedSpotIds}
            selectedLocation={selectedLocation}
            onSelectLocation={handleSelectLocation}
            userCoords={userCoords}
            onOpenDenzel={() => setShowTutorial(true)}
            onWalletClick={() => setDenzelMessage(denzelWalletMessage)}
            completedLocations={completedLocationIds}
            singleGroupActive={singleGroupActive}
            courses={courses}
            coursesActive={coursesActive}
            coursesFocused={coursesFocused}
            completedCourseIds={completedCourseIds}
            coursePhotos={coursePhotos}
            selectedCourseId={selectedCourse?.id ?? null}
            onSelectCourse={handleSelectCourse}
          />

          {/* Filters exposed directly on the map (hidden during an active run so
              the chrono HUD owns the top of the screen). */}
          {activeRunLocationId === null && (
            <MapFilterBar
              activeGroups={activeGroups}
              onToggleGroup={toggleGroup}
              onSelectAll={selectAllGroups}
            />
          )}

        </section>

        {/* MOBILE SLIDE-OVER LIST */}
        <section className={`app-bg absolute inset-0 z-40 md:hidden pt-12 pb-14 ${activeTab === 'list' ? 'block' : 'hidden'}`}>
          <div className="w-full h-full flex flex-col">
            {/* Quick Filters blended inside mobile Spots page */}
            <div
              className="py-1 border-b border-[color:var(--hairline)] shadow-md shrink-0"
              style={{
                background: 'color-mix(in srgb, var(--surface) 55%, transparent)',
                backdropFilter: 'blur(var(--blur-glass))',
                WebkitBackdropFilter: 'blur(var(--blur-glass))',
              }}
            >
              <QuickFilterBar
                activeGroups={activeGroups}
                onToggleGroup={toggleGroup}
                onSelectAll={selectAllGroups}
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <LocationsList
                locations={allLocations}
                selectedLocation={selectedLocation}
                activeGroups={activeGroups}
                onSelectLocation={handleSelectLocation}
                userCoords={userCoords}
              />
            </div>
          </div>
        </section>

        {/* UNIVERSALLY ACCESSIBLE Spectacular "SOCIAL CLUB / TROPHÉES" STANDALONE VIEW */}
        <section className={`app-bg absolute inset-0 z-[490] pt-12 pb-14 md:pb-0 overflow-y-auto ${activeTab === 'trophies' ? 'block' : 'hidden'}`}>
          <CoverQuest
            completedCourseIds={completedCourseIds}
            coursePhotos={coursePhotos}
            capturedPhotos={capturedPhotos}
            spotPhotos={spotPhotos}
            freePhotos={freePhotos}
            gtaPhotos={gtaPhotos}
            gtaStatus={gtaStatus}
            completedTimes={completedTimes}
            onRegenerate={regenerateGta}
            onAddFreePhoto={handleAddFreePhoto}
            onDeleteFreePhoto={handleDeleteFreePhoto}
          />
        </section>

      </main>

      {/* RENDER THE BOTTOM SHEET DYNAMIC PANEL */}
      <BottomSheet
        location={selectedLocation}
        course={selectedCourse}
        onClose={() => { setSelectedLocation(null); setSelectedCourse(null); }}
        onCenterOnMap={handleCenterOnMap}
        userCoords={userCoords}
        isCompleted={selectedLocation ? completedLocationIds.includes(selectedLocation.id) : false}
        onCompleteLocation={handleCompleteLocation}
        onLaunchNavigation={() => { pendingReopenRef.current = true; }}
        activeRunLocationId={activeRunLocationId}
        onStartRun={handleStartRun}
        onStopRun={handleStopRun}
        elapsedTime={elapsedTime}
        onSavePhoto={handleSavePhotoSouvenir}
        activeRunCourseId={activeRunCourseId}
        onStartCourseRun={handleStartCourseRun}
        completedCourseIds={completedCourseIds}
        onCaptureSpotPhoto={handleCaptureSpotPhoto}
        onVisitSpot={handleVisitSpot}
      />

      {/* ACTIVE STOPWATCH RUN DYNAMIC MULTI-VIEW GLOBAL HUD OVERLAY */}
      {(activeRunLocationId !== null || activeRunCourseId !== null) && (
        <div className="fixed top-[52px] left-1/2 -translate-x-1/2 w-[92%] max-w-sm sm:max-w-md bg-zinc-950/95 backdrop-blur-md border border-red-500/40 p-3.5 rounded-2xl flex flex-col gap-2 shadow-[0_15px_30px_rgba(0,0,0,0.65)] z-[800] font-mono animate-pulse" style={{ animationDuration: '4s' }}>
          <div className="w-full flex items-center justify-between text-[8px] sm:text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-rose-500">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping shrink-0" />
              CHRONO EN COURS...
            </span>
            <span className="text-amber-500">ZONE GEOFENCE 50M</span>
          </div>
          
          <div className="text-2xl sm:text-3xl font-black text-rose-500 tracking-widest text-center py-1 font-mono">
            {getFormattedElapsedTime()}
          </div>
          
          {/* Target Location Mini stats & sectors */}
          <div className="text-[10px] text-zinc-300 flex items-center justify-between border-t border-zinc-900 pt-1.5">
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-zinc-500 shrink-0">CIBLE :</span>
              <span className="font-sans font-bold text-white truncate max-w-[130px] sm:max-w-[180px]">
                {activeRunCourseId !== null
                  ? courses.find((c) => c.id === activeRunCourseId)?.title
                  : allLocations.find((l) => l.id === activeRunLocationId)?.name}
              </span>
            </div>
            <div className="font-mono text-[9px] text-emerald-400 font-bold shrink-0">128 km/h • Δ -0.4s</div>
          </div>

          <div className="mt-1 shrink-0">
            <button
              onClick={activeRunCourseId !== null ? handleStopCourseRun : handleStopRun}
              className="w-full py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-[9px] uppercase cursor-pointer border border-zinc-800 transition-colors"
            >
              Abandonner le run
            </button>
          </div>
        </div>
      )}

      {/* ════ DEV — simulateur de géofence, gated derrière ?dev=1 / localStorage.
          Dry-run à froid : chrono-stop + validation run + prompt photo, sans GPS
          réel. Appelle le vrai applyGeofence aux coords cibles. */}
      {devMode && (
      <div className="fixed left-2 bottom-20 md:bottom-4 z-[9000] flex flex-col gap-1 p-2 rounded-xl bg-fuchsia-950/95 border border-fuchsia-500/60 shadow-2xl font-mono text-[10px] select-none">
        <span className="text-fuchsia-300 font-black uppercase tracking-wider">DEV · géofence</span>
        <button
          onClick={devSimulateArrival}
          className="px-2 py-1 rounded bg-fuchsia-700 hover:bg-fuchsia-600 active:scale-95 text-white font-bold cursor-pointer text-left"
        >
          🏁 Simuler arrivée (run)
        </button>
        <button
          onClick={devSimulatePhotoSpot}
          className="px-2 py-1 rounded bg-fuchsia-700 hover:bg-fuchsia-600 active:scale-95 text-white font-bold cursor-pointer text-left"
        >
          📸 Simuler spot photo
        </button>
        <span className="text-fuchsia-300/70 max-w-[160px] truncate">
          {activeRunCourseId
            ? `run: ${activeRunCourseId}`
            : activeRunLocationId !== null
              ? `run spot #${activeRunLocationId}`
              : selectedCourse
                ? `course: ${selectedCourse.id}`
                : 'lance/sélectionne une course'}
        </span>
      </div>
      )}

      {/* 4. MOBILE PERSISTENT BOTTOM NAVIGATION SWITCHER FOOTER */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 z-[9999] pb-safe flex items-center justify-around select-none md:hidden"
        style={{ height: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        
        {/* 1. Carte / GPS Tab trigger */}
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
            activeTab === 'map' ? 'text-[#FF6A4A] font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <MapIcon size={18} className={activeTab === 'map' ? 'text-[#FF6A4A]' : ''} />
            {selectedLocation && activeTab !== 'map' && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
          <span className="text-[9px] tracking-wide font-display font-medium uppercase mt-0.5">Carte / GPS</span>
        </button>

        {/* 2. Spots list trigger */}
        <button
          data-tour="spots"
          onClick={() => setActiveTab('list')}
          className={`flex-1 h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
            activeTab === 'list' ? 'text-[#FF6A4A] font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <Compass size={18} className={activeTab === 'list' ? 'text-[#FF6A4A]' : ''} />
            <span className="absolute -top-1 -right-3 font-mono text-[8px] bg-slate-950 text-amber-400 px-1 rounded border border-slate-800">
              {visibleLocations.length}
            </span>
          </div>
          <span className="text-[9px] tracking-wide font-display font-medium uppercase mt-0.5">Spots</span>
        </button>

        {/* 3. Social Club standalone trigger */}
        <button
          data-tour="social-club"
          onClick={() => { setActiveTab('trophies'); ensureNotifPermission(); }}
          className={`flex-1 h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
            activeTab === 'trophies' ? 'text-[#FF6A4A] font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Trophy size={18} className={activeTab === 'trophies' ? 'text-[#FF6A4A] animate-pulse' : ''} />
          </div>
          <span className="text-[9px] tracking-wide font-display font-medium uppercase mt-0.5">Social Club</span>
        </button>

      </footer>

      {/* GTA-Style Animated Fullscreen Banner Overlay */}
      <AnimatePresence>
        {showGtaOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-black/85 backdrop-blur-xs select-none"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: -30, opacity: 0 }}
              transition={{ type: 'spring', damping: 15 }}
              className="text-center p-4 flex flex-col gap-3 max-w-lg"
            >
              {/* Golden Trophy Icon with pulse ring wrapper */}
              <div className="mx-auto w-20 h-20 rounded-full bg-amber-500/15 border-2 border-amber-400 flex items-center justify-center text-amber-500 shadow-xl mb-4 animate-bounce">
                <Trophy size={36} className="animate-pulse" />
              </div>

              {/* GTA-Style Cinematic bar banner with skew */}
              <div className="bg-amber-400 py-3.5 px-12 border-y-4 border-black font-display font-black text-2xl md:text-3xl text-black uppercase tracking-widest skew-x-[-8deg] shadow-2xl">
                MISSION RÉUSSIE
              </div>

              {/* Subtitle details */}
              <div className="font-mono text-xs tracking-widest text-zinc-300 font-bold uppercase mt-2">
                TROPHEÉ DÉBLOQUÉ SUR TENERIFE
              </div>
              
              <div className="text-amber-400 font-display font-extrabold text-lg leading-snug">
                {completedMissionName}
              </div>

              <p className="text-xs text-zinc-400 max-w-sm mx-auto font-sans leading-relaxed mt-1">
                La progression a été sauvegardée avec succès sur Tenerife (Mémoire LocalStorage).
              </p>

              {/* Close confirmation button */}
              <button
                onClick={() => setShowGtaOverlay(false)}
                className="mt-6 bg-white hover:bg-zinc-100 text-zinc-950 font-extrabold px-8 py-3.5 rounded-2xl text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all cursor-pointer border border-zinc-200"
              >
                Continuer la conduite
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DENZEL SAG — narrator handler messages */}
      <DenzelMessage message={denzelMessage} onDismiss={() => setDenzelMessage(null)} />

      {/* El Jefe info-bulle at a course photo point (< 50 m) */}
      <CoursePhotoPrompt
        course={coursePhotoPrompt}
        onCapture={handleCaptureCoursePhoto}
        onClose={() => setCoursePhotoPrompt(null)}
      />

      {/* Bandeau persistance stockage — discret, non bloquant, dismissable.
          Affiché seulement si navigator.storage.persist() a été refusé/indispo. */}
      {showStorageBanner && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[850] w-[92%] max-w-md flex items-start gap-2.5 px-3.5 py-2.5 rounded-2xl bg-zinc-950/95 backdrop-blur-md border border-amber-500/40 shadow-[0_12px_30px_rgba(0,0,0,0.55)]"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
          role="status"
        >
          <span className="text-base leading-none mt-0.5">📥</span>
          <p className="flex-1 text-[11px] leading-snug text-zinc-200">
            Pour ne pas perdre tes photos, garde l'app sur l'écran d'accueil et ouvre-la régulièrement.
          </p>
          <button
            onClick={dismissStorageBanner}
            aria-label="Fermer"
            className="shrink-0 p-1 rounded-full text-zinc-400 hover:text-white active:scale-95 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

    </div>
  );
}
