/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Camera, X } from 'lucide-react';
import elJefeAvatar from '../assets/eljefe-avatar.webp';
import { DenzelLine } from '../data/denzelMessages';
import { PANEL_URLS } from '../data/panelImages';
import { CourseData } from '../data/coursesData';

interface CoursePhotoPromptProps {
  /** The course whose photo point the player just reached (< 50 m). Null = hidden. */
  course: CourseData | null;
  /** El Jefe line to show ("prends ton meilleur cliché"). */
  line: DenzelLine | null;
  /** Hands back the compressed base64 photo for the course. */
  onCapture: (course: CourseData, base64: string) => void;
  onClose: () => void;
}

// Keep course photos under the localStorage quota (same budget as cover snaps).
const MAX_DIM = 420;

/** Resize + compress a captured/imported photo to a compact JPEG dataURL. */
function compress(base64: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64);
      // Same cinematic grade as the cover camera, for a consistent look.
      ctx.filter = 'contrast(1.18) saturate(1.35) brightness(1.02)';
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

/**
 * El Jefe info-bulle that pops over everything when the player is within 50 m of
 * a course's photo point (the arrival by default, the start when photoAtStart).
 * It carries the custom Denzel line + the `visuel`, and triggers the capture.
 */
export default function CoursePhotoPrompt({ course, line, onCapture, onClose }: CoursePhotoPromptProps) {
  const reduce = useReducedMotion();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !course) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compress(reader.result as string);
      onCapture(course, compressed);
    };
    reader.readAsDataURL(file);
  };

  return (
    <AnimatePresence>
      {course && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center px-4 pointer-events-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950 pointer-events-auto"
          />

          {/* El Jefe info-bulle */}
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0.25 } : { type: 'spring', damping: 24, stiffness: 230 }}
            className="relative w-full max-w-sm pointer-events-auto select-none rounded-3xl overflow-hidden border border-[color:var(--hairline)] shadow-[0_24px_60px_rgba(0,0,0,0.6)] bg-[#0a0810]"
          >
            {/* Panel illustration behind a dark veil */}
            {line && (
              <img
                src={PANEL_URLS[line.panel]}
                alt=""
                aria-hidden
                className="absolute inset-0 w-full h-full object-cover opacity-45"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0810]/80 via-[#0a0810]/85 to-[#0a0810]/95" />

            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full text-white/70 hover:text-white transition-opacity"
              aria-label="Plus tard"
            >
              <X size={16} />
            </button>

            <div className="relative z-[2] p-5 flex flex-col gap-4">
              {/* El Jefe header */}
              <div className="flex items-center gap-3">
                <img
                  src={elJefeAvatar}
                  alt="El Jefe"
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#EA4423]/70 shrink-0"
                />
                <div className="min-w-0">
                  <span className="block font-mono text-[10px] font-black uppercase tracking-[2px] text-[#EA4423]">
                    ● El Jefe
                  </span>
                  <span className="block font-display font-extrabold text-white text-sm leading-tight truncate">
                    {course.title}
                  </span>
                </div>
              </div>

              {/* The custom Denzel line */}
              {line && (
                <p className="text-sm text-white font-semibold leading-relaxed">{line.text}</p>
              )}

              {/* What to frame (visuel) */}
              <p className="text-xs text-white/75 leading-relaxed italic border-l-2 border-[#EA4423]/60 pl-3">
                {course.visuel}
              </p>

              {/* Capture */}
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#EA4423] hover:bg-[#d63d1f] text-white text-sm font-black uppercase tracking-wide transition-all shadow-lg active:scale-95 cursor-pointer"
              >
                <Camera size={16} />
                <span>Prendre mon meilleur cliché</span>
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile}
              className="hidden"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
