/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Radio, X } from 'lucide-react';
import elJefeAvatar from '../assets/eljefe-avatar.webp';

interface DenzelMessageProps {
  /** The line to show (from src/data/denzelMessages). Null = hidden. */
  message: string | null;
  onDismiss: () => void;
  /** Auto-hide delay (ms). */
  autoHideMs?: number;
}

/**
 * Denzel Sag — bandeau « message du handler » (GTA-HUD).
 * Verre sombre + Space Grotesk + accent vert handler, dans l'esthétique du
 * splash et des cartes du Social Club. Apparaît à l'arrivée d'un message,
 * fermable au tap, et se masque seul après ~6 s. Respecte les safe-area et
 * prefers-reduced-motion.
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
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          role="status"
          aria-live="polite"
          onClick={onDismiss}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.98 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
          transition={reduce ? { duration: 0.2 } : { type: 'spring', damping: 22, stiffness: 220 }}
          className="fixed left-1/2 -translate-x-1/2 z-[900] w-[92%] max-w-sm sm:max-w-md cursor-pointer pointer-events-auto select-none"
          style={{ top: 'calc(3.4rem + env(safe-area-inset-top))' }}
        >
          <div className="relative flex gap-3 items-start overflow-hidden rounded-2xl border border-[color:var(--hairline)] bg-[var(--glass-bg)] backdrop-blur-xl p-3 pr-9 shadow-[0_16px_34px_rgba(0,0,0,0.5)]">
            {/* Handler accent rail */}
            <span
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ background: 'var(--isla-cash)' }}
            />

            {/* El Jefe avatar — round vignette with a GTA-HUD ring */}
            <img
              src={elJefeAvatar}
              alt="El Jefe"
              className="shrink-0 rounded-full object-cover"
              style={{
                width: 52,
                height: 52,
                border: '2px solid var(--isla-cash)',
                boxShadow: '0 0 0 3px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.5)',
              }}
            />

            <div className="min-w-0 text-left">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Radio size={11} style={{ color: 'var(--isla-cash)' }} />
                <span
                  className="font-mono text-[9px] font-black uppercase tracking-[2px]"
                  style={{ color: 'var(--isla-cash)' }}
                >
                  El Jefe
                </span>
              </div>
              <p className="font-display text-[12.5px] leading-snug text-[color:var(--text)]">
                {message}
              </p>
            </div>

            {/* Close */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              aria-label="Fermer le message"
              className="absolute top-2 right-2 p-1 rounded-md text-[color:var(--text-muted)] transition-opacity hover:opacity-70"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
