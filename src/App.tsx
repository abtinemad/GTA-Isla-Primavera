/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LocationItem, Category } from './types';
import { INITIAL_LOCATIONS } from './locationsData';
import QuickFilterBar from './components/QuickFilterBar';
import MapContainer from './components/MapContainer';
import { CATEGORY_MAP, haversineKm } from './utils/helper';
import LocationsList from './components/LocationsList';
import BottomSheet from './components/BottomSheet';
import CoverQuest from './components/CoverQuest';
import CoverCamera from './components/CoverCamera';
import SplashScreen from './components/SplashScreen';
import DenzelMessage from './components/DenzelMessage';
import TutorialOverlay from './components/TutorialOverlay';
import { CoverSlot, approachRadiusKm, isPhotoSlot, shortLabel } from './coverData';
import {
  getDenzelAmbient,
  getDenzelReopenPrompt,
  getDenzelPhotoPrompt,
  getDenzelChronoPrompt,
  denzelTutorial,
  DenzelLine,
  PanelKey,
} from './data/denzelMessages';
import {
  Compass,
  Map,
  Trophy,
  Wallet,
  CheckCircle2,
  X,
  MessageSquare,
  Sun,
  Moon,
  HelpCircle
} from 'lucide-react';

export default function App() {
  // --- CORE GAMEPLAY STATE ---
  const [selectedCategory, setSelectedCategory] = useState<Category | 'Tous'>('Tous');
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  // Persistence state
  const [completedLocationIds, setCompletedLocationIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('tenirife_completed_locations');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [capturedPhotos, setCapturedPhotos] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem('tenirife_captured_photos');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [completedTimes, setCompletedTimes] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem('tenirife_completed_times');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // UI state
  const [showSplash, setShowSplash] = useState(true);
  // First-run Denzel tutorial — shown once (persisted via "tutorialSeen").
  const [showTutorial, setShowTutorial] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tutorialSeen') !== 'true';
    } catch (e) {
      return true;
    }
  });
  const finishTutorial = useCallback(() => {
    setShowTutorial(false);
    try {
      localStorage.setItem('tutorialSeen', 'true');
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
  const [walletAmount, setWalletAmount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tenirife_wallet');
      return saved !== null ? JSON.parse(saved) : 1500;
    } catch (e) {
      return 1500;
    }
  });
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // Persist the wallet like the rest of the game state (completions/photos/times).
  useEffect(() => {
    try {
      localStorage.setItem('tenirife_wallet', JSON.stringify(walletAmount));
    } catch (e) {
      /* persistence best-effort */
    }
  }, [walletAmount]);

  // Theme (Manrique/Vice design tokens — see src/styles/tokens.css)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('isla_theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch (e) {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('isla_theme', theme);
    } catch (e) {
      /* persistence best-effort */
    }
  }, [theme]);
  
  // Custom HUD states
  const [activeRunLocationId, setActiveRunLocationId] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const stopwatchIntervalRef = useRef<any>(null);
  // Mirror of elapsedTime read by the geofence effect, so that effect does not
  // need elapsedTime in its deps (which would re-subscribe watchPosition ~30x/s).
  const elapsedTimeRef = useRef<number>(0);

  // Cover Quest — camera overlay for the currently-targeted cover slot
  const [coverCameraSlot, setCoverCameraSlot] = useState<CoverSlot | null>(null);
  // Slots we've already pinged for proximity (fire-once until the player leaves).
  const approachAlertedRef = useRef<Set<number>>(new Set());

  // On app open (once the splash is gone), if no mission is running, greet the
  // player with an ambient Denzel line — but at most once every 30 min (persisted).
  // The cooldown only gates the AMBIENT line; action messages always fire.
  useEffect(() => {
    // Wait until both the splash and the first-run tutorial are dismissed.
    if (!showSplash && !showTutorial && !ambientFiredRef.current) {
      ambientFiredRef.current = true;
      if (activeRunLocationId !== null) return;

      const COOLDOWN_MS = 30 * 60 * 1000;
      let last = 0;
      try {
        last = Number(localStorage.getItem('tenirife_denzel_ambient_ts')) || 0;
      } catch (e) {
        last = 0;
      }
      if (Date.now() - last >= COOLDOWN_MS) {
        setDenzelMessage(getDenzelAmbient());
        try {
          localStorage.setItem('tenirife_denzel_ambient_ts', String(Date.now()));
        } catch (e) {
          /* best-effort */
        }
      }
    }
  }, [showSplash, showTutorial]);

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

  const allLocations = useMemo(() => {
    return INITIAL_LOCATIONS;
  }, []);

  // Trophy markers (id 101-105, "🏆 Trophées - …") duplicate physical spots and
  // are surfaced via the trophy panels, not as map pins / list spots.
  const filteredListLocations = useMemo(() => {
    const physical = allLocations.filter((loc) => !loc.category.startsWith('🏆'));
    if (selectedCategory === 'Tous') {
      return physical;
    }
    return physical.filter((loc) => loc.category === selectedCategory);
  }, [allLocations, selectedCategory]);

  // Only Missions / Escapades / Plages have an in-app completion flow (chrono
  // geofence or photo). Other categories and the trophy markers (id 101-105)
  // are never completable, so they must not inflate the completion denominator.
  const completableLocations = useMemo(
    () => allLocations.filter(
      (l) => l.category === 'Missions' || l.category === 'Escapades' || l.category === 'Plages'
    ),
    [allLocations]
  );

  const completedCount = useMemo(
    () => completedLocationIds.filter(id => completableLocations.some(l => l.id === id)).length,
    [completedLocationIds, completableLocations]
  );

  // Proportional completion over the completable dataset.
  const completionPct = useMemo(() => {
    const total = completableLocations.length;
    return total > 0 ? (completedCount / total) * 100 : 0;
  }, [completedCount, completableLocations]);

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

  // Trigger geolocation checks
  const requestGeolocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          alert("L'acquisition GPS a échoué. Mode Simulation actif.");
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  };

  // Run stopwatch controls
  const handleStartRun = (locId: number) => {
    // Denzel briefs the chrono run as it starts.
    setDenzelMessage(getDenzelChronoPrompt());
    setActiveRunLocationId(locId);
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

  const handleStopRun = () => {
    if (stopwatchIntervalRef.current) {
      clearInterval(stopwatchIntervalRef.current);
      stopwatchIntervalRef.current = null;
    }
    setActiveRunLocationId(null);
    startTimeRef.current = null;
    elapsedTimeRef.current = 0;
    setElapsedTime(0);
  };

  const handleSavePhotoSouvenir = (locId: number, base64: string) => {
    const nextPhotos = { ...capturedPhotos, [locId]: base64 };
    setCapturedPhotos(nextPhotos);
    localStorage.setItem('tenirife_captured_photos', JSON.stringify(nextPhotos));
  };

  // Cover Quest snap = front-end of the existing validation. The camera only
  // opens for a slot within the 50 m geofence (enforced in CoverQuest), so this
  // routes straight through the shared souvenir + completion handlers — no
  // parallel state. A timed mission records its elapsed run at the moment of snap.
  const handleCoverCommit = (slot: CoverSlot, dataUrl: string) => {
    handleSavePhotoSouvenir(slot.id, dataUrl);
    let finishTime: string | undefined;
    if (slot.category === 'Missions' && activeRunLocationId === slot.id) {
      finishTime = getFormattedElapsedTime();
      handleStopRun();
    }
    handleCompleteLocation(slot.location, finishTime);
    setCoverCameraSlot(null);
  };

  // Trigger game rewards
  const handleCompleteLocation = (location: LocationItem, finishTime?: string) => {
    if (completedLocationIds.includes(location.id)) return;
    const nextCompleted = [...completedLocationIds, location.id];
    setCompletedLocationIds(nextCompleted);
    localStorage.setItem('tenirife_completed_locations', JSON.stringify(nextCompleted));

    if (finishTime) {
      const nextTimes = { ...completedTimes, [location.id]: finishTime };
      setCompletedTimes(nextTimes);
      localStorage.setItem('tenirife_completed_times', JSON.stringify(nextTimes));
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

  // Continuous geofencing watchdog — keeps userCoords fresh so cover slots and
  // map proximity stay accurate. Subscribed once for the app's lifetime.
  useEffect(() => {
    if (!navigator.geolocation) return;

    const computeDistance = (lat1: number, lng1: number, lat2: number, lng2: number) =>
      haversineKm(lat1, lng1, lat2, lng2);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        setUserCoords({ lat: userLat, lng: userLng });

        // Mission completion = crossing the 50 m chrono finish line (canonical
        // model, see CLAUDE.md). Cover Quest does NOT replace this; mission cover
        // tiles fill from this completion. Escapades/Plages validate by photo.
        if (activeRunLocationId !== null) {
          const runTarget = allLocations.find(l => l.id === activeRunLocationId);
          if (runTarget) {
            const currentDist = computeDistance(userLat, userLng, runTarget.lat, runTarget.lng);
            if (currentDist <= 0.050) { // 50m geofence reached!
              // Freeze time and wrap up
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

        // Approach notification — ping once when entering an incomplete slot's
        // zone (Missions 100 m, Escapades/Plages 500 m). Reuses the QG toast.
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
              ? `Tu es sur ${label}. Ouvre la jaquette (Social Club) et prends ta photo pour valider.`
              : `Tu approches de ${label}. Prépare ton run chrono.`;
            setDenzelMessage({ text: body, panel: isPhoto ? 'corales' : 'car' });
            playSmsChirp();
            void notifyOS(`Zone atteinte · ${label}`, body, `approach_${loc.id}`);
          } else if (alerted && d > radius * 1.6) {
            approachAlertedRef.current.delete(loc.id); // left the zone → re-armable
          }
        });
      },
      (err) => {
        console.warn("Geofence watchPosition telemetry error:", err);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
    // elapsedTime intentionally excluded — read via elapsedTimeRef so the watch
    // is not torn down and re-registered on every stopwatch tick (~30x/s).
  }, [completedLocationIds, allLocations, activeRunLocationId]);

  // When a spot is targeted
  const handleSelectLocation = (location: LocationItem) => {
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
    <div className="app-bg relative w-screen h-screen overflow-hidden select-none font-sans flex flex-col text-zinc-900">

      {/* BOOT SPLASH — artwork GTA déjà titré, plein cadre (fade out 0.5s) */}
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      </AnimatePresence>

      {/* FIRST-RUN TUTORIAL — Denzel onboarding, shown once (after the splash) */}
      {!showSplash && showTutorial && (
        <TutorialOverlay steps={denzelTutorial} onComplete={finishTutorial} />
      )}

      {/* FLOATING GLASSMORPHIC HUD HEADER */}
      <div className="absolute top-0 left-0 right-0 z-[600] h-12 flex items-center bg-slate-900/60 backdrop-blur-md border-b border-slate-700/30 shadow-xl pointer-events-auto">
        <div className="w-full px-4 flex items-center justify-between gap-4 h-full">
          
          {/* Left / Center: Global Completion Progress Bar */}
          <div data-tour="progress" className="flex items-center gap-2.5 flex-1 max-w-sm sm:max-w-md">
            <span 
              className="text-[#4ade80] text-[10px] sm:text-xs font-mono font-black tracking-wider whitespace-nowrap"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 5px rgba(74,222,128,0.4)' }}
            >
              {completionPct.toFixed(0)}% COMPLETION
            </span>
            <div className="flex-1 h-2 bg-slate-950/80 rounded-full overflow-hidden border border-slate-700/50 p-[1.5px] shadow-inner max-w-[124px] sm:max-w-none">
              <div 
                className="h-full bg-[#22c55e] rounded-full transition-all duration-700 shadow-[0_0_7px_rgba(34,197,94,0.6)]" 
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>

          {/* Right Displays: replay tutorial + theme toggle + emerald green wealth wallet indicator */}
          <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTutorial(true)}
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-950/90 border-2 border-slate-700/50 text-cyan-300 transition-all shadow-lg active:scale-95 cursor-pointer hover:border-cyan-400/50"
            aria-label="Revoir le didacticiel"
            title="Revoir le didacticiel"
          >
            <HelpCircle size={14} />
          </button>
          <button
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-950/90 border-2 border-slate-700/50 text-amber-300 transition-all shadow-lg active:scale-95 cursor-pointer hover:border-amber-400/50"
            aria-label={theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
            title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            onClick={() => setIsWalletModalOpen(true)}
            className="flex items-center gap-2 bg-slate-950/90 border-2 border-emerald-500/40 text-[#4ade80] font-mono text-xs sm:text-sm font-black px-3 py-1 rounded-lg transition-all shadow-2xl active:scale-95 cursor-pointer select-none shadow-[0_0_12px_rgba(74,222,128,0.25)] hover:border-emerald-500/60 h-7"
            style={{
              textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 4px rgba(74,222,128,0.5)',
              fontStyle: 'italic'
            }}
          >
            <span>{walletAmount} €</span>
          </button>
          </div>

        </div>
      </div>

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
                selectedCategory={selectedCategory}
                onSelectCategory={(cat) => {
                  setSelectedCategory(cat);
                  if (cat !== 'Tous' && selectedLocation && selectedLocation.category !== cat) {
                    setSelectedLocation(null);
                  }
                }}
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <LocationsList
                locations={allLocations}
                selectedLocation={selectedLocation}
                selectedCategory={selectedCategory}
                onSelectLocation={handleSelectLocation}
                userCoords={userCoords}
              />
            </div>
          </div>
        </section>

        {/* MAP STAGE FRAME (re-centers automatically) */}
        <section data-tour="map" className={`flex-1 h-full relative ${activeTab === 'map' ? 'block' : 'hidden md:block'} ${activeTab === 'trophies' ? 'hidden md:hidden' : ''}`}>
          
          <MapContainer
            locations={filteredListLocations}
            selectedLocation={selectedLocation}
            onSelectLocation={handleSelectLocation}
            userCoords={userCoords}
            onRequestGeolocation={requestGeolocation}
            completedLocations={completedLocationIds}
          />

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
                selectedCategory={selectedCategory}
                onSelectCategory={(cat) => {
                  setSelectedCategory(cat);
                  if (cat !== 'Tous' && selectedLocation && selectedLocation.category !== cat) {
                    setSelectedLocation(null);
                  }
                }}
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <LocationsList
                locations={allLocations}
                selectedLocation={selectedLocation}
                selectedCategory={selectedCategory}
                onSelectLocation={handleSelectLocation}
                userCoords={userCoords}
              />
            </div>
          </div>
        </section>

        {/* UNIVERSALLY ACCESSIBLE Spectacular "SOCIAL CLUB / TROPHÉES" STANDALONE VIEW */}
        <section className={`app-bg absolute inset-0 z-[490] pt-12 pb-14 md:pb-0 overflow-y-auto ${activeTab === 'trophies' ? 'block' : 'hidden'}`}>
          <CoverQuest
            completedLocationIds={completedLocationIds}
            capturedPhotos={capturedPhotos}
            completedTimes={completedTimes}
            userCoords={userCoords}
            onOpenCamera={(slot) => {
              // Photo-mission reaches its "take the photo" step.
              setDenzelMessage(getDenzelPhotoPrompt());
              setCoverCameraSlot(slot);
            }}
          />
        </section>

      </main>

      {/* RENDER THE BOTTOM SHEET DYNAMIC PANEL */}
      <BottomSheet
        location={selectedLocation}
        onClose={() => setSelectedLocation(null)}
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
      />

      {/* ACTIVE STOPWATCH RUN DYNAMIC MULTI-VIEW GLOBAL HUD OVERLAY */}
      {activeRunLocationId !== null && (
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
                {allLocations.find(l => l.id === activeRunLocationId)?.name}
              </span>
            </div>
            <div className="font-mono text-[9px] text-emerald-400 font-bold shrink-0">128 km/h • Δ -0.4s</div>
          </div>

          <div className="mt-1 shrink-0">
            <button
              onClick={handleStopRun}
              className="w-full py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-[9px] uppercase cursor-pointer border border-zinc-800 transition-colors"
            >
              Abandonner le run
            </button>
          </div>
        </div>
      )}

      {/* 4. MOBILE PERSISTENT BOTTOM NAVIGATION SWITCHER FOOTER */}
      <footer className="fixed bottom-0 left-0 right-0 h-14 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 z-[9999] pb-safe flex items-center justify-around select-none md:hidden">
        
        {/* 1. Carte / GPS Tab trigger */}
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
            activeTab === 'map' ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Map size={18} className={activeTab === 'map' ? 'text-amber-400' : ''} />
            {selectedLocation && activeTab !== 'map' && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
          <span className="text-[9px] tracking-wide font-display font-medium uppercase mt-0.5">Carte / GPS</span>
        </button>

        {/* 2. Spots list trigger */}
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
            activeTab === 'list' ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <Compass size={18} className={activeTab === 'list' ? 'text-amber-400' : ''} />
            <span className="absolute -top-1 -right-3 font-mono text-[8px] bg-slate-950 text-amber-400 px-1 rounded border border-slate-800">
              {filteredListLocations.length}
            </span>
          </div>
          <span className="text-[9px] tracking-wide font-display font-medium uppercase mt-0.5">Spots</span>
        </button>

        {/* 3. Social Club standalone trigger */}
        <button
          data-tour="social-club"
          onClick={() => { setActiveTab('trophies'); ensureNotifPermission(); }}
          className={`flex-1 h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
            activeTab === 'trophies' ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Trophy size={18} className={activeTab === 'trophies' ? 'text-amber-400 animate-pulse' : ''} />
          </div>
          <span className="text-[9px] tracking-wide font-display font-medium uppercase mt-0.5">Social Club</span>
        </button>

      </footer>

      {/* Wallet Recharge Confirmation Modal */}
      {isWalletModalOpen && (
        <div id="wallet-modal" className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs">
          <div className="bg-white border border-zinc-250 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative overflow-hidden flex flex-col gap-4">
            <span className="absolute top-0 left-0 right-0 h-[3.5px] bg-[#47a064]" />
            
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Wallet size={24} className="animate-pulse" />
            </div>

            <div className="text-center">
              <h3 className="font-display font-black text-sm text-zinc-950 tracking-wide uppercase">Recharge de Solde</h3>
              <p className="text-xs text-zinc-600 font-sans mt-2 leading-relaxed">
                Ajouter 50 € de crédits de jeu (fictifs) à ton solde ? Aucun paiement réel n'est effectué.
              </p>
              <div className="bg-zinc-50 rounded-xl p-2.5 border border-zinc-150 mt-3 font-mono text-[11px] text-zinc-650">
                Solde actuel : <span className="text-[#47a064] font-black">{walletAmount} €</span>
              </div>
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                onClick={() => setIsWalletModalOpen(false)}
                className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-950 font-medium py-2 rounded-xl text-xs transition-colors border border-zinc-200 cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  // In-game fictional credit only — no real payment is triggered.
                  setWalletAmount(prev => prev + 50);
                  setIsWalletModalOpen(false);
                }}
                className="flex-1 bg-[#47a064] hover:bg-[#3f8e58] text-white font-bold py-2 rounded-xl text-xs transition-all cursor-pointer shadow-lg active:scale-95"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* COVER QUEST — full-screen geofenced camera overlay */}
      <CoverCamera
        slot={coverCameraSlot}
        onClose={() => setCoverCameraSlot(null)}
        onCommit={handleCoverCommit}
      />

      {/* DENZEL SAG — narrator handler messages */}
      <DenzelMessage message={denzelMessage} onDismiss={() => setDenzelMessage(null)} />

    </div>
  );
}
