/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Radio, X } from 'lucide-react';
import elJefeAvatar from '../assets/eljefe-avatar.webp';
import { DenzelLine } from '../data/denzelMessages';
import { PANEL_URLS } from '../data/panelImages';

interface DenzelMessageProps {
  /** The line to show ({ text, panel }) from src/data/denzelMessages. Null = hidden. */
  message: DenzelLine | null;
  onDismiss: () => void;
  /** Auto-hide delay (ms). */
  autoHideMs?: number;
}

/**
 * Denzel Sag (El Jefe) — bandeau « message du handler » (GTA-HUD).
 * Le panel illustré du DenzelLine s'affiche EN FOND (object-cover), recouvert d'un
 * voile sombre costaud pour la lisibilité ; avatar El Jefe + texte au premier plan.
 * Crossfade doux quand le message/panel change. Apparaît à l'arrivée d'un message,
 * fermable au tap, se masque seul après ~6 s. Safe-area + prefers-reduced-motion.
 */
export default function DenzelMessage({ message, onDismiss, autoHideMs = 6000 }: DenzelMessageProps) {
  const reduce = useReducedMotion();

  // Auto-hide while a message is shown.
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDismiss, autoHideMs);
    return () => window.clearTimeout(t);
  }, [message, onDismiss, autoHideMs]);

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[900] w-[92%] max-w-sm sm:max-w-md pointer-events-none"
      style={{ top: 'calc(3.4rem + env(safe-area-inset-top))' }}
    >
      {/* mode="popLayout" so the outgoing and incoming messages crossfade in place. */}
      <AnimatePresence mode="popLayout">
        {message && (
          <motion.div
            key={message.text}
            role="status"
            aria-live="polite"
            onClick={onDismiss}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.98 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0.25 } : { type: 'spring', damping: 24, stiffness: 230 }}
            className="cursor-pointer pointer-events-auto select-none"
          >
            <div className="relative flex gap-3 items-start overflow-hidden rounded-2xl border border-[color:var(--hairline)] p-3 pr-9 shadow-[0_16px_34px_rgba(0,0,0,0.55)] bg-[#0a0810]">
              {/* Panel illustration — full-frame background */}
              <img
                src={PANEL_URLS[message.panel]}
                alt=""
                aria-hidden
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Strong dark veil — keeps the text readable over bright/busy panels */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(105deg, rgba(8,6,16,0.93) 0%, rgba(8,6,16,0.82) 46%, rgba(8,6,16,0.62) 100%)',
                }}
              />

              {/* Handler accent rail */}
              <span
                className="absolute left-0 top-0 bottom-0 w-[3px] z-[2]"
                style={{ background: 'var(--isla-cash)' }}
              />

              {/* El Jefe avatar — round vignette with a GTA-HUD ring */}
              <img
                src={elJefeAvatar}
                alt="El Jefe"
                className="relative z-[2] shrink-0 rounded-full object-cover"
                style={{
                  width: 52,
                  height: 52,
                  border: '2px solid var(--isla-cash)',
                  boxShadow: '0 0 0 3px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.55)',
                }}
              />

              <div className="relative z-[2] min-w-0 text-left">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Radio size={11} style={{ color: 'var(--isla-cash)' }} />
                  <span
                    className="font-mono text-[9px] font-black uppercase tracking-[2px]"
                    style={{ color: 'var(--isla-cash)' }}
                  >
                    El Jefe
                  </span>
                </div>
                <p
                  className="font-display text-[12.5px] leading-snug text-white"
                  style={{ textShadow: '0 1px 4px rgba(0,0,0,0.85)' }}
                >
                  {message.text}
                </p>
              </div>

              {/* Close */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                aria-label="Fermer le message"
                className="absolute top-2 right-2 z-[2] p-1 rounded-md text-white/70 transition-opacity hover:opacity-80"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
