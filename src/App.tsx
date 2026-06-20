/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LocationItem, Category } from './types';
import { INITIAL_LOCATIONS } from './locationsData';
import QuickFilterBar from './components/QuickFilterBar';
import MapContainer from './components/MapContainer';
import { CATEGORY_MAP } from './utils/helper';
import LocationsList from './components/LocationsList';
import BottomSheet from './components/BottomSheet';
import {
  Compass,
  Map,
  Trophy,
  Wallet,
  CheckCircle2,
  X,
  MessageSquare
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
  const [showGtaOverlay, setShowGtaOverlay] = useState(false);
  const [completedMissionName, setCompletedMissionName] = useState('');
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'trophies'>('map');
  const [walletAmount, setWalletAmount] = useState(1500);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  
  // Custom HUD states
  const [activeRunLocationId, setActiveRunLocationId] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const stopwatchIntervalRef = useRef<any>(null);
  // Mirror of elapsedTime read by the geofence effect, so that effect does not
  // need elapsedTime in its deps (which would re-subscribe watchPosition ~30x/s).
  const elapsedTimeRef = useRef<number>(0);

  // Character Narrative SMS State
  const [incomingSms, setIncomingSms] = useState<{ title: string; text: string; id: string } | null>(null);

  // Automatically dismiss SMS after 6 seconds of visibility
  useEffect(() => {
    if (incomingSms) {
      const timer = setTimeout(() => {
        setIncomingSms(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [incomingSms]);

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

    // Event-driven SMS triggers from Denzel Sag
    let smsText = "Objectif validé. Le QG valide le transfert des fonds. Continue comme ça.";
    let regionId = "default";
    if (location.id === 8) {
      smsText = "Propre. La spéciale de Teno est pliée et le Stelvio n'a pas une égratignure. On passe à la suite.";
      regionId = "teno_complete";
    } else if (location.id === 7) {
      smsText = "Tu as dompté le volcan. Le grip noir n'a plus de secret pour toi. Joli run.";
      regionId = "teide_complete";
    } else if (location.id === 9) {
      smsText = "Maître du Flow débloqué. Même sous la canopée glissante, la trajectoire était parfaite.";
      regionId = "anaga_complete";
    }

    // Instantly display the temporary push-notification banner
    setIncomingSms({
      title: "Denzel Sag",
      text: smsText,
      id: regionId
    });
    playSmsChirp();
  };

  // Continuous geofencing watchdog
  useEffect(() => {
    if (!navigator.geolocation) return;

    const computeDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371; // Earth's radius in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // inside km
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        setUserCoords({ lat: userLat, lng: userLng });

        // Check active stopwatch run completion (within 50 meters geofence)
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
    <div className="relative w-screen h-screen bg-slate-950 overflow-hidden select-none font-sans flex flex-col text-zinc-900">
      
      {/* FLOATING GLASSMORPHIC HUD HEADER */}
      <div className="absolute top-0 left-0 right-0 z-[600] h-12 flex items-center bg-slate-900/60 backdrop-blur-md border-b border-slate-700/30 shadow-xl pointer-events-auto">
        <div className="w-full px-4 flex items-center justify-between gap-4 h-full">
          
          {/* Left / Center: Global Completion Progress Bar */}
          <div className="flex items-center gap-2.5 flex-1 max-w-sm sm:max-w-md">
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

          {/* Right Displays: Emerald green wealth wallet indicator */}
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

      {/* 3. Primary Viewboard container (Occupies full viewport so map tiles flow under header) */}
      <main className="absolute inset-0 w-full h-full flex overflow-hidden z-0 bg-slate-950">
        
        {/* DESKTOP SPLIT VIEW: sidebar list (Padded to start below floating glassmorphic header) */}
        <section className={`hidden md:block w-80 lg:w-96 h-full shrink-0 border-r border-slate-800/40 pt-12 bg-[#fafafa] z-10 transition-all ${activeTab === 'trophies' ? 'opacity-0 select-none pointer-events-none absolute' : ''}`}>
          <div className="flex flex-col h-full bg-[#fafafa]">
            {/* Quick Filters blended inside sidebar */}
            <div className="bg-slate-900 py-1 border-b border-slate-800 shadow-md shrink-0">
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
        <section className={`flex-1 h-full relative ${activeTab === 'map' ? 'block' : 'hidden md:block'} ${activeTab === 'trophies' ? 'hidden md:hidden' : ''}`}>
          
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
        <section className={`absolute inset-0 z-40 md:hidden pt-12 pb-14 ${activeTab === 'list' ? 'block' : 'hidden'}`}>
          <div className="w-full h-full bg-[#fafafa] flex flex-col">
            {/* Quick Filters blended inside mobile Spots page */}
            <div className="bg-slate-900 py-1 border-b border-slate-800 shadow-md shrink-0">
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
        <section className={`absolute inset-0 z-[490] bg-[#121214] pt-12 pb-14 md:pb-0 overflow-y-auto ${activeTab === 'trophies' ? 'block' : 'hidden'}`}>
          <div className="max-w-4xl mx-auto px-4 py-8 pb-24 flex flex-col gap-6">
            
            {/* Header section in Dark theme */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-400 flex items-center justify-center text-amber-400">
                  <Trophy size={20} className="animate-pulse" />
                </div>
                <div className="text-left">
                  <h2 className="font-display font-black text-xl text-white uppercase tracking-wider">Social Club Trophées</h2>
                  <span className="text-[10px] uppercase tracking-wider font-mono font-black text-[#47a064]">
                    Tenerife Drive Achievements & Souvenirs
                  </span>
                </div>
              </div>

              {/* Stats widget */}
              <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-2xl flex items-center gap-4 text-left">
                <div className="font-mono">
                  <span className="block text-[8px] uppercase tracking-wider text-zinc-500">Progression</span>
                  <span className="text-base font-black text-white">{completedCount} / {completableLocations.length} validés</span>
                </div>
                <div className="w-px h-6 bg-zinc-800" />
                <div className="font-mono text-right">
                  <span className="block text-[8px] uppercase tracking-wider text-zinc-500">Complété</span>
                  <span className="text-base font-black text-amber-400">{completionPct.toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {/* Grid Layout of Achievements */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  id: 102,
                  physicalId: 7,
                  name: 'Au-dessus des Nuages',
                  desc: 'Atteindre le plateau central du Teide par la TF-21.',
                  road: 'Route TF-21 · Volcan',
                  type: 'Missions'
                },
                {
                  id: 101,
                  physicalId: 8,
                  name: 'Roi de la Gomme',
                  desc: 'Dompter les épingles de Cherfe (TF-436) au sommet de Masca.',
                  road: 'Route TF-436 · Masca',
                  type: 'Missions'
                },
                {
                  id: 9,
                  physicalId: 9,
                  name: 'Maître du Flow',
                  desc: 'Compléter le run de la forêt humide d\'Anaga (TF-12).',
                  road: 'TF-12 · Épreuve Anaga',
                  type: 'Missions'
                },
                {
                  id: 103,
                  physicalId: 10,
                  name: 'Chasseur de Fantômes',
                  desc: 'Explorer le sanatorium abandonné d\'Abades (Preuve photo).',
                  road: 'Sortie 42 TF-1 · Abades',
                  type: 'Escapades'
                },
                {
                  id: 104,
                  physicalId: 12,
                  name: 'Grand Tourer',
                  desc: 'Effectuer la liaison côtière par Radazul ou El Médano.',
                  road: 'Liaison TF-1 · Côte Est',
                  type: 'Missions'
                },
                {
                  id: 17,
                  physicalId: 17,
                  name: 'Chasseur de Criques',
                  desc: 'Gagner la crique de Diego Hernández (Preuve photo).',
                  road: 'Secteur Ouest · Diego Hernández',
                  type: 'Plages'
                },
                {
                  id: 18,
                  physicalId: 18,
                  name: 'Contraste Total',
                  desc: 'Sanctuariser la plage de Las Teresitas (Preuve photo).',
                  road: 'Anaga Est · S. Sahara',
                  type: 'Plages'
                },
                {
                  id: 105,
                  physicalId: 2, // Cannabis Mr Bruno etc combined
                  name: 'Ravitaillement Complet',
                  desc: 'Valider Mr Bruno, secrets tasca ou Bloom Bar à La Caleta.',
                  road: 'Secteur Ouest · La Caleta',
                  type: 'Ravitaillement'
                }
              ].map((trophy) => {
                // Determine completion status
                const isTrophyCompleted = 
                  trophy.id === 104 
                    ? (completedLocationIds.includes(12) || completedLocationIds.includes(13))
                    : trophy.id === 105
                      ? (completedLocationIds.includes(2) || completedLocationIds.includes(3) || completedLocationIds.includes(5))
                      : completedLocationIds.includes(trophy.physicalId);

                const recordedTime = completedTimes[trophy.physicalId];
                const capturedPhotoBase64 = capturedPhotos[trophy.physicalId];

                // Resolve category mapping
                const catName = trophy.type as Category;
                const catInfo = CATEGORY_MAP[catName] || CATEGORY_MAP.Missions;
                const designatedCategoryEmoji = catInfo.emoji;

                // Category-specific Canarian accent colors
                let cardBgStyle = 'border-zinc-800 bg-zinc-900/60';
                let textAccent = 'text-zinc-500';
                let badgeStyle = 'bg-zinc-800/50 border border-zinc-700/60 text-zinc-500/60 grayscale opacity-45';
                let dynamicCardStyle = {};
                let dynamicBadgeStyle = {};

                if (isTrophyCompleted) {
                  textAccent = 'text-white';
                  cardBgStyle = '';
                  badgeStyle = 'text-white border-white/20 animate-pulse';
                  const activeColor = catInfo.accentColor;
                  dynamicCardStyle = {
                    borderColor: `${activeColor}60`,
                    backgroundColor: `${activeColor}20`,
                    boxShadow: `0 4px 20px ${activeColor}30`
                  };
                  dynamicBadgeStyle = {
                    backgroundColor: activeColor,
                    boxShadow: `0 0 15px ${activeColor}80`
                  };
                }

                return (
                  <div
                    key={trophy.name}
                    className={`relative rounded-3xl border p-5 flex flex-col gap-3 text-left transition-all duration-300 overflow-hidden min-h-[170px] ${cardBgStyle}`}
                    style={dynamicCardStyle}
                  >
                    
                    {/* User-uploaded custom photo background helper for Escapades / Plages */}
                    {isTrophyCompleted && capturedPhotoBase64 && (
                      <div className="absolute inset-0 z-0">
                        <img 
                          src={capturedPhotoBase64} 
                          alt="" 
                          className="w-full h-full object-cover opacity-25 filter blur-[1px]" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#121214] via-[#121214]/70 to-[#121214]/40" />
                      </div>
                    )}

                    {/* Content Body */}
                    <div className="relative z-10 flex flex-col gap-2.5 h-full justify-between flex-1">
                      <div className="flex items-start justify-between w-full min-w-0">
                        <div className="flex items-center gap-2.5">
                          <div 
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-sans text-xl shadow-lg border ${badgeStyle}`}
                            style={dynamicBadgeStyle}
                          >
                            {designatedCategoryEmoji}
                          </div>
                          <div className="text-left">
                            <h4 className={`text-xs font-black font-display uppercase tracking-wider max-w-[170px] truncate ${textAccent}`}>
                              {trophy.name}
                            </h4>
                            <span className="block text-[8px] font-mono text-zinc-400 font-bold uppercase tracking-wide">
                              {trophy.road}
                            </span>
                          </div>
                        </div>

                        {/* Top lock/checked status indicators */}
                        {isTrophyCompleted ? (
                          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-[7px] uppercase tracking-wider px-1.5 py-0.5 rounded">
                            Débloqué
                          </span>
                        ) : (
                          <span className="bg-zinc-800 border border-zinc-700 text-zinc-500 font-bold text-[7px] uppercase tracking-wider px-1.5 py-0.5 rounded">
                            Verrouillé
                          </span>
                        )}
                      </div>

                      <p className={`text-[11px] font-sans leading-relaxed ${
                        isTrophyCompleted ? 'text-zinc-300' : 'text-zinc-650'
                      }`}>
                        {trophy.desc}
                      </p>

                      {/* Score metrics if completed (stopwatch time details) */}
                      {isTrophyCompleted && (
                        <div className="pt-2 mt-auto border-t border-zinc-800/60 flex items-center justify-between text-[9px] font-mono text-zinc-400">
                          <div className="flex items-center gap-1">
                            <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
                            <span>Run validé</span>
                          </div>
                          {recordedTime && (
                            <div className="font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                              Score : {recordedTime}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Resume button */}
            <div className="mt-4">
              <button
                onClick={() => setActiveTab('map')}
                className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold uppercase px-8 py-3.5 rounded-2xl border border-zinc-850 text-xs tracking-widest transition-all cursor-pointer shadow-lg mx-auto"
              >
                Retourner à la carte
              </button>
            </div>

          </div>
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
          onClick={() => setActiveTab('trophies')}
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

      {/* CHARACTER NARRATIVE OVERLAY CELLULAR PHONE SMS SLIDEOUT (Sleek Real-Time Push Notification Toast Banner) */}
      <AnimatePresence>
        {incomingSms && (
          <motion.div
            initial={{ y: -80, x: '-50%', opacity: 0 }}
            animate={{ y: 0, x: '-50%', opacity: 1 }}
            exit={{ y: -80, x: '-50%', opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 180 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] w-[92%] max-w-sm sm:max-w-md bg-zinc-950/95 backdrop-blur-lg border border-cyan-500/30 rounded-2xl p-3 px-4 shadow-[0_15px_30px_rgba(0,0,0,0.6),0_0_15px_rgba(6,182,212,0.15)] pointer-events-auto flex flex-col gap-2"
          >
            {/* Notification Header / App Branding */}
            <div className="flex items-center justify-between text-[8px] font-mono font-black text-cyan-400 tracking-widest select-none">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={10} className="text-cyan-400 drop-shadow-[0_0_2px_rgba(34,211,238,0.5)]" />
                <span>DRIVE MSG • ALERT</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 font-extrabold">MAINTENANT</span>
                <button
                  onClick={() => setIncomingSms(null)}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-0.5 rounded-md hover:bg-zinc-800"
                  aria-label="Dismiss Notification"
                >
                  <X size={10} />
                </button>
              </div>
            </div>

            {/* Notification Body */}
            <div className="flex items-start gap-3">
              {/* Character Avatar */}
              <div className="w-8 h-8 rounded-full border border-emerald-500 bg-neutral-950 flex items-center justify-center font-bold text-emerald-400 text-xs shadow-[0_0_8px_rgba(16,185,129,0.3)] shrink-0 select-none">
                DS
              </div>
              
              <div className="flex-1 text-left min-w-0">
                <span className="block text-[10px] font-mono font-black text-emerald-400 uppercase tracking-wide leading-none mb-1">
                  {incomingSms.title}
                </span>
                <p className="text-[10px] text-zinc-200 leading-normal font-sans italic pr-2">
                  "{incomingSms.text}"
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

    </div>
  );
}
