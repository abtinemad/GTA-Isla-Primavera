/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Radio, ChevronRight, Check } from 'lucide-react';
import { DenzelTutorialStep } from '../data/denzelMessages';

interface TutorialOverlayProps {
  steps: DenzelTutorialStep[];
  /** Called when the tour finishes ("Commencer") OR is skipped ("Passer"). */
  onComplete: () => void;
}

/**
 * Didacticiel d'onboarding plein écran raconté par Denzel Sag — une étape à la
 * fois (title + message), « Suivant » / « Commencer », points de progression,
 * « Passer ». Esthétique GTA-HUD / splash : fond #0B0C10 + dégradé sunset
 * canarien, Space Grotesk. Safe-area + prefers-reduced-motion.
 */
export default function TutorialOverlay({ steps, onComplete }: TutorialOverlayProps) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  if (!steps || steps.length === 0) return null;

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const next = () => (isLast ? onComplete() : setIndex((i) => Math.min(i + 1, steps.length - 1)));

  return (
    <div
      className="fixed inset-0 z-[10000] bg-[#0B0C10] overflow-hidden flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Didacticiel"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
      }}
    >
      {/* Canarian sunset backdrop (même esprit que le splash) */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(135% 80% at 50% 0%, #ff9d5c 0%, #fb6f6a 14%, #e8527f 28%, #b6499a 44%, #7d4aa6 62%, #5a52a4 80%, #0B0C10 100%)',
          opacity: 0.5,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, transparent 40%, #0B0C10 100%)' }}
      />

      {/* Top bar: handler tag + Passer */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-4">
        <div className="flex items-center gap-1.5">
          <Radio size={12} style={{ color: 'var(--isla-cash)' }} />
          <span
            className="font-mono text-[9px] font-black uppercase tracking-[3px]"
            style={{ color: 'var(--isla-cash)' }}
          >
            Denzel Sag · Briefing
          </span>
        </div>
        <button
          onClick={onComplete}
          className="font-mono text-[10px] uppercase tracking-[2px] text-white/55 hover:text-white/90 transition-colors cursor-pointer px-2 py-1"
        >
          Passer
        </button>
      </div>

      {/* Step content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-7 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -14 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="max-w-md flex flex-col items-center"
          >
            <span className="font-mono text-[10px] font-bold tracking-[2px] text-white/45 mb-3">
              {String(index + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
            </span>
            <h2
              className="font-display font-black text-white uppercase leading-[1.05] mb-4"
              style={{ fontSize: 'clamp(26px, 7vw, 38px)', letterSpacing: '-0.5px', textShadow: '0 3px 0 rgba(0,0,0,.4)' }}
            >
              {step.title}
            </h2>
            <p
              className="font-display text-white/85 leading-relaxed"
              style={{ fontSize: 'clamp(14px, 3.6vw, 17px)' }}
            >
              {step.message}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer: progress dots + Next/Start */}
      <div className="relative z-10 px-6 pb-8 pt-4 flex flex-col items-center gap-5">
        <div className="flex items-center gap-2">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Étape ${i + 1}`}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === index ? 22 : 7,
                background: i === index ? 'var(--isla-cash)' : 'rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="w-full max-w-sm flex items-center justify-center gap-2 py-3.5 rounded-2xl font-display font-black uppercase tracking-wide text-[#0a0a0b] active:scale-95 transition-transform cursor-pointer"
          style={{ background: 'var(--isla-cash)', boxShadow: '0 8px 22px rgba(70,174,60,0.35)' }}
        >
          {isLast ? (
            <>
              Commencer <Check size={17} />
            </>
          ) : (
            <>
              Suivant <ChevronRight size={17} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
