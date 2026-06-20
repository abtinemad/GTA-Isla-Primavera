/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { CoverSlot } from '../coverData';
import { CATEGORY_MAP } from '../utils/helper';
import { X, Camera, ImagePlus, Loader2, AlertTriangle } from 'lucide-react';

interface CoverCameraProps {
  slot: CoverSlot | null;
  onClose: () => void;
  /** Front-end of the existing validation: hands back the GTA-ified dataURL. */
  onCommit: (slot: CoverSlot, dataUrl: string) => void;
}

// Compact output keeps capturedPhotos[] under the localStorage quota.
const MAX_DIM = 420;

export default function CoverCamera({ slot, onClose, onCommit }: CoverCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);

  const accent = slot ? CATEGORY_MAP[slot.category].accentColor : '#EA4423';

  // Start / stop the live camera with the lifetime of the overlay.
  useEffect(() => {
    if (!slot) return;
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        // iOS Safari is fussy about getUserMedia — gallery import is the fallback.
        setCamError('Caméra indisponible. Utilise l’import galerie ci-dessous.');
      }
    };
    start();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [slot]);

  // Draws a source frame to canvas, applies the category filter, returns a dataURL.
  const gtaify = (source: HTMLVideoElement | HTMLImageElement, sw: number, sh: number): string => {
    const scale = Math.min(1, MAX_DIM / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Cinematic grade
    ctx.filter = 'contrast(1.18) saturate(1.35) brightness(1.02)';
    ctx.drawImage(source, 0, 0, w, h);
    ctx.filter = 'none';

    // Category tint in overlay blend
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    return canvas.toDataURL('image/jpeg', 0.72);
  };

  const commit = (dataUrl: string) => {
    if (!slot || !dataUrl) return;
    onCommit(slot, dataUrl);
  };

  const handleSnap = () => {
    if (!slot || busy) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setCamError('Flux caméra non prêt — réessaie ou importe une photo.');
      return;
    }
    setBusy(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    const dataUrl = gtaify(video, video.videoWidth, video.videoHeight);
    commit(dataUrl);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !slot) return;
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => commit(gtaify(img, img.width, img.height));
      img.onerror = () => setBusy(false);
      img.src = reader.result as string;
    };
    reader.onerror = () => setBusy(false);
    reader.readAsDataURL(file);
  };

  if (!slot) return null;

  return (
    <div className="fixed inset-0 z-[3000] bg-black flex flex-col select-none">
      {/* Live viewfinder */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'contrast(1.12) saturate(1.25)' }}
      />

      {/* Vignette + scanlines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 50%, transparent 55%, rgba(0,0,0,.6) 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,.08) 0 1px, transparent 1px 3px)',
        }}
      />

      {/* Corner reticles */}
      {[
        'top-20 left-5 border-t-2 border-l-2',
        'top-20 right-5 border-t-2 border-r-2',
        'bottom-36 left-5 border-b-2 border-l-2',
        'bottom-36 right-5 border-b-2 border-r-2',
      ].map((pos) => (
        <div key={pos} className={`absolute w-9 h-9 border-white/80 pointer-events-none ${pos}`} />
      ))}

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-5 pb-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex flex-col">
          <span
            className="font-mono text-[10px] font-black uppercase tracking-[2px]"
            style={{ color: accent }}
          >
            ● Trophée en cours
          </span>
          <span className="font-display font-black text-white text-lg leading-tight uppercase tracking-wide">
            {slot.label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-black/50 border border-white/20 text-white active:scale-95 cursor-pointer"
          aria-label="Fermer la caméra"
        >
          <X size={18} />
        </button>
      </div>

      {/* Flash */}
      {flash && <div className="absolute inset-0 bg-white z-20 pointer-events-none" />}

      {/* Error toast */}
      {camError && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[82%] max-w-xs bg-zinc-950/90 border border-amber-500/40 rounded-2xl p-4 flex items-start gap-2.5 text-left">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-200 leading-relaxed">{camError}</p>
        </div>
      )}

      {/* Footer controls */}
      <div className="relative z-10 mt-auto px-6 pb-9 pt-6 bg-gradient-to-t from-black/85 to-transparent flex items-center justify-between">
        {/* Gallery fallback */}
        <button
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center gap-1 text-white/90 active:scale-95 cursor-pointer"
          aria-label="Importer depuis la galerie"
        >
          <span className="w-12 h-12 rounded-2xl border border-white/30 bg-black/40 flex items-center justify-center">
            <ImagePlus size={20} />
          </span>
          <span className="text-[9px] font-mono uppercase tracking-wider">Galerie</span>
        </button>

        {/* Shutter */}
        <button
          onClick={handleSnap}
          disabled={busy}
          className="relative w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 cursor-pointer disabled:opacity-60"
          style={{ boxShadow: `0 0 28px ${accent}80` }}
          aria-label="Prendre la photo"
        >
          <span
            className="w-15 h-15 rounded-full flex items-center justify-center"
            style={{ width: 60, height: 60, backgroundColor: accent }}
          >
            {busy ? (
              <Loader2 size={24} className="text-white animate-spin" />
            ) : (
              <Camera size={24} className="text-white" />
            )}
          </span>
        </button>

        {/* Spacer for symmetry */}
        <span className="w-12 h-12" />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImport}
        className="hidden"
      />
    </div>
  );
}
