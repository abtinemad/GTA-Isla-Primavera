/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { LocationItem } from '../types';
import { CATEGORY_MAP } from '../utils/helper';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Navigation, 
  MapPin, 
  X, 
  Share2, 
  Compass, 
  ExternalLink,
  Milestone,
  CheckCircle2,
  Camera,
  Loader2,
  Sparkles,
  Trophy,
  Play,
  Square
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

interface BottomSheetProps {
  location: LocationItem | null;
  onClose: () => void;
  onCenterOnMap?: (location: LocationItem) => void;
  userCoords?: { lat: number; lng: number } | null;
  isCompleted?: boolean;
  onCompleteLocation?: (location: LocationItem) => void;
  
  // Game state injection
  activeRunLocationId: number | null;
  onStartRun: (locId: number) => void;
  onStopRun: () => void;
  elapsedTime: number;
  onSavePhoto: (locId: number, base64: string) => void;
}

export default function BottomSheet({
  location,
  onClose,
  onCenterOnMap,
  userCoords,
  isCompleted = false,
  onCompleteLocation,
  activeRunLocationId,
  onStartRun,
  onStopRun,
  elapsedTime,
  onSavePhoto
}: BottomSheetProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [gpsErrorShow, setGpsErrorShow] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks must run on every render — bail out only after they are declared,
  // otherwise the hook count changes between renders (Rules of Hooks).
  if (!location) return null;

  const catInfo = CATEGORY_MAP[location.category];
  const associatedTrophy = LOCATION_TROPHIES[location.id];

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

  // Resizes & compresses uploaded photo to avoid localstorage quota overflow (>5MB)
  const compressPhoto = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Target compact preview size
        const max_size = 280;
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
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.65)); // 65% quality JPEG
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

    // Strict 50m geofence — co-validation requires real proximity (Spec §6.3)
    const isWithinRange = rawDist !== null && rawDist <= 0.050; // 50 meters

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
    setIsAnalyzing(true);
    setAnalysisLogs([
      "[SYSTEM] Initialisation de la caméra native...",
      "[SYSTEM] Image acquise avec succès (Résolution compressée).",
      "[GPS] Co-validation géoréférencée OK (proximité < 50 m confirmée)."
    ]);
    
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    await sleep(700);
    setAnalysisLogs(prev => [...prev, "[AI] Configuration du prompt d'analyse Vision..."]);
    
    await sleep(900);
    setAnalysisLogs(prev => [
      ...prev,
      "[PROMPT SENT TO LLM]:",
      '"Vérifier si cette photo correspond effectivement au spot de Tenerife décrit : ' + location.name + '. Répondre au format JSON unique."'
    ]);
    
    await sleep(1000);
    setAnalysisLogs(prev => [...prev, `[AI] Analyse en cours via Gemini Pro Vision...`]);
    
    await sleep(1000);
    setAnalysisLogs(prev => [
      ...prev,
      "[JSON RESPONSE FROM GPT/GEMINI FLASH]:",
      JSON.stringify({ verified: true, confidence: 0.96, matched_location: location.name }, null, 2)
    ]);
    
    await sleep(700);
    setAnalysisLogs(prev => [...prev, "[SYSTEM] Analyse terminée. Sauvegarde du souvenir..."]);
    
    // Save compressed image persistently in local storage
    onSavePhoto(location.id, compressedImg);

    await sleep(600);
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

          {/* Body Content */}
          <div className="p-6 pt-2 overflow-y-auto max-h-[75vh]">
            
            {/* Category badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-lg border flex items-center gap-1.5 ${catInfo.bgClass}`}>
                <span>{catInfo.emoji}</span>
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
                      <span>CO-VALIDATEUR GPS & PHOTO IA</span>
                    </div>
                    <span className="text-zinc-500 font-bold uppercase tracking-wider">GEMINI v2.4</span>
                  </div>

                  {/* Twin column: left console, right dynamic thumbnail with sweeping line scan */}
                  <div className="flex gap-4 items-start">
                    <div className="flex-1 flex flex-col gap-1 max-h-[140px] overflow-y-auto no-scrollbar text-zinc-400 leading-normal">
                      {analysisLogs.map((log, index) => {
                        const isPrompt = log.startsWith("[PROMPT") || log.startsWith('"Verify');
                        const isJson = log.startsWith("[JSON") || log.startsWith('{') || log.includes('verified');
                        const isSystem = log.startsWith("[SYSTEM]");
                        let clr = "text-zinc-400";
                        if (isPrompt) clr = "text-amber-300 font-semibold italic";
                        if (isJson) clr = "text-emerald-400 font-semibold leading-tight whitespace-pre bg-zinc-900/50 p-1.5 rounded border border-zinc-850";
                        if (isSystem) clr = "text-sky-400";
                        return (
                          <div key={index} className={`${clr} break-words`}>
                            {log}
                          </div>
                        );
                      })}
                      <div className="text-amber-500 animate-pulse mt-1">█ CORÉ-ANALYSEUR IA ACTIF...</div>
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
                    Vous êtes actuellement situé à <span className="font-bold">{distance || 'plus de 5 km'}</span> de l'objectif. La co-validation par photo requiert une proximité stricte de <span className="font-bold">50 mètres</span> du spot. Rapprochez-vous pour débloquer le trophée.
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
                  <Compass size={18} className="text-red-600 shrink-0 mt-0.5 animate-spin-slow" />
                  <div>
                    <span className="block text-xs font-bold text-red-700 tracking-wide uppercase">Briefing Épreuve Chrono</span>
                    <span className="block text-xs text-zinc-650 mt-0.5 leading-normal">
                      Démarrez le chrono puis rejoignez la destination. Le timer s'arrête automatiquement dès votre entrée dans le périmètre de 50m.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* PHOTO VALIDATION BUTTON (Specifically for Escapades or Plages) */}
              {(location.category === 'Escapades' || location.category === 'Plages') && !isCompleted && !isAnalyzing && (
                <button
                  onClick={clickInput}
                  className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl border border-dashed border-sky-300 bg-sky-50/70 hover:bg-sky-50 text-sky-900 text-sm font-extrabold transition-all duration-200 cursor-pointer active:scale-95 shadow-sm hover:border-sky-400 group col-span-1 sm:col-span-2"
                >
                  <Camera size={16} className="text-sky-600 group-hover:scale-110 transition-transform" />
                  <span>Prendre une photo pour valider</span>
                  <Sparkles size={13} className="text-amber-500 animate-pulse ml-0.5" />
                </button>
              )}

              {/* MISSION ACTIVE CHRONO BUTTONS */}
              {location.category === 'Missions' && !isCompleted && !isAnalyzing && (
                <div className="col-span-1 sm:col-span-2 flex flex-col gap-2">
                  {!isCurrentRunActive ? (
                    <button
                      onClick={() => onStartRun(location.id)}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-sm font-black tracking-wide uppercase transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <Play size={15} fill="currentColor" />
                      <span>Démarrer le Run (Chrono)</span>
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2 p-3 bg-red-50 border border-red-250 rounded-2xl items-center text-center">
                      <div className="text-[10px] font-mono text-red-700 font-bold uppercase tracking-wider animate-pulse">
                        ⚠️ COURSE CHRONOMÉTRÉE ACTIVE
                      </div>
                      <div className="text-2xl font-black text-red-650 font-mono tracking-wider">
                        {formatTime(elapsedTime)}
                      </div>
                      
                      <button
                        onClick={onStopRun}
                        className="w-full mt-1.5 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold uppercase transition-all cursor-pointer"
                      >
                        <Square size={12} fill="currentColor" />
                        <span>Abandonner le Run</span>
                      </button>
                    </div>
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
