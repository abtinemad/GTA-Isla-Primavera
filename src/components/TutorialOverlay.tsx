/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Radio, ChevronRight, Check } from 'lucide-react';
import { DenzelTutorialStep, PanelKey } from '../data/denzelMessages';
import { PANEL_URLS } from '../data/panelImages';
import elJefeAvatar from '../assets/eljefe-avatar.webp';
import SplashSpinner from './SplashSpinner';

// Panel illustration behind the CENTERED tutorial steps (target=null). Spotlight
// steps stay dark so the highlighted UI element reads clearly.
const TUTORIAL_PANELS: Record<string, PanelKey> = {
  'Bienvenue à Isla Primavera': 'eljefe',
  'Le deal': 'couple',
  'À toi de jouer': 'car',
};

interface TutorialOverlayProps {
  steps: DenzelTutorialStep[];
  /** Called when the tour finishes ("Commencer") OR is skipped ("Passer"). */
  onComplete: () => void;
}

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8; // spotlight padding around the target
const GAP = 14; // gap between target and dialog
const MARGIN = 14; // viewport safety margin

/**
 * Tour guidé Denzel Sag : déroule denzelTutorial dans l'ordre, avec spotlight sur
 * les vrais éléments ([data-tour]) et carte de dialogue placée selon `placement`
 * (repositionnement auto). Étapes target=null = panneau plein écran centré.
 * Esthétique GTA-HUD / splash. Safe-area + prefers-reduced-motion.
 */
export default function TutorialOverlay({ steps, onComplete }: TutorialOverlayProps) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Splash-style loader over the centered-step panel until its image is ready.
  const [panelLoaded, setPanelLoaded] = useState(false);
  useEffect(() => {
    setPanelLoaded(false);
  }, [index]);

  const step = steps && steps[index];
  const isLast = index === (steps?.length ?? 0) - 1;

  const place = useCallback(
    (r: Rect | null, placement?: string) => {
      const card = cardRef.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cw = Math.min(card?.offsetWidth || 360, vw - 2 * MARGIN);
      const ch = card?.offsetHeight || 200;

      // Centered (no target / not found)
      if (!r) {
        setPos({ top: Math.max(MARGIN, (vh - ch) / 2), left: (vw - cw) / 2, width: cw });
        return;
      }

      const cx = r.left + r.width / 2;
      let left = Math.max(MARGIN, Math.min(cx - cw / 2, vw - cw - MARGIN));

      const below = r.top + r.height + GAP;
      const above = r.top - GAP - ch;
      let top: number;
      if (placement === 'top') {
        top = above >= MARGIN ? above : below; // flip down if no room above
      } else {
        // 'bottom' (and any other) → below, flip up if no room
        top = below + ch <= vh - MARGIN ? below : above;
      }
      top = Math.max(MARGIN, Math.min(top, vh - ch - MARGIN));
      setPos({ top, left, width: cw });
    },
    [],
  );

  const measure = useCallback(() => {
    const s = steps?.[index];
    if (!s) return;
    if (s.target) {
      const el = document.querySelector<HTMLElement>(`[data-tour="${s.target}"]`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          const next = { top: r.top, left: r.left, width: r.width, height: r.height };
          setRect(next);
          place(next, s.placement);
          return;
        }
      }
    }
    setRect(null);
    place(null);
  }, [index, steps, place]);

  // Recompute on step change + resize / orientation. useLayoutEffect so the card
  // is positioned before paint (its real size is read from the ref).
  useLayoutEffect(() => {
    measure();
    const raf = requestAnimationFrame(measure); // second pass once card has size
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [measure]);

  if (!steps || steps.length === 0) return null;

  const next = () => (isLast ? onComplete() : setIndex((i) => Math.min(i + 1, steps.length - 1)));
  const spotlight = !!rect;

  return (
    <div
      className="fixed inset-0 z-[10000]"
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
      {spotlight ? (
        // Spotlight cutout — a huge box-shadow dims everything but the target.
        <motion.div
          aria-hidden
          className="fixed pointer-events-none"
          style={{
            borderRadius: 14,
            boxShadow: '0 0 0 9999px rgba(8,5,18,0.80)',
            border: '2px solid var(--isla-cash)',
          }}
          initial={reduce ? false : { opacity: 0 }}
          animate={{
            opacity: 1,
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + 2 * PAD,
            height: rect.height + 2 * PAD,
          }}
          transition={reduce ? { duration: 0 } : { type: 'spring', damping: 26, stiffness: 240 }}
        />
      ) : (
        // Centered step — El Jefe panel illustration full-frame behind the card,
        // veiled for legibility (same spirit as the message bubble).
        <div className="fixed inset-0 bg-[#0B0C10] overflow-hidden">
          <img
            key={index}
            src={PANEL_URLS[TUTORIAL_PANELS[step.title] || 'eljefe']}
            alt=""
            aria-hidden
            onLoad={() => setPanelLoaded(true)}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
            style={{ opacity: panelLoaded ? 1 : 0 }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(11,12,16,0.55) 0%, rgba(11,12,16,0.72) 55%, #0B0C10 100%)',
            }}
          />
          {/* Splash loader (above the veil, in the visible panel area over the card) */}
          {!panelLoaded && (
            <div className="absolute left-0 right-0 flex justify-center" style={{ top: '22vh' }}>
              <SplashSpinner size={48} label="Chargement" />
            </div>
          )}
        </div>
      )}

      {/* Dialog card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          ref={cardRef}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="fixed rounded-2xl border border-[color:var(--hairline)] bg-[#14101c]/95 backdrop-blur-xl shadow-[0_18px_40px_rgba(0,0,0,0.55)] p-5"
          style={{
            top: pos ? pos.top : '50%',
            left: pos ? pos.left : '50%',
            width: pos ? pos.width : 'min(360px, 92vw)',
            transform: pos ? undefined : 'translate(-50%, -50%)',
            visibility: pos ? 'visible' : 'hidden',
          }}
        >
          {/* Top row: step counter + Passer */}
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-mono text-[9px] font-bold tracking-[2px] text-white/40">
              {String(index + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
            </span>
            <button
              onClick={onComplete}
              className="font-mono text-[9px] uppercase tracking-[2px] text-white/55 hover:text-white/90 transition-colors cursor-pointer"
            >
              Passer
            </button>
          </div>

          <h2
            className="font-display font-black text-white uppercase leading-[1.08] mb-3"
            style={{ fontSize: 'clamp(20px, 5.5vw, 26px)', letterSpacing: '-0.4px' }}
          >
            {step.title}
          </h2>

          {/* El Jefe speaker block — avatar + label above the line */}
          <div className="flex gap-3 items-start mb-4">
            <img
              src={elJefeAvatar}
              alt="El Jefe"
              className="shrink-0 rounded-full object-cover"
              style={{
                width: 76,
                height: 76,
                border: '2.5px solid var(--isla-cash)',
                boxShadow: '0 0 0 3px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.55)',
              }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <Radio size={11} style={{ color: 'var(--isla-cash)' }} />
                <span
                  className="font-mono text-[9px] font-black uppercase tracking-[2.5px]"
                  style={{ color: 'var(--isla-cash)' }}
                >
                  El Jefe
                </span>
              </div>
              <p className="font-display text-white/85 leading-relaxed text-[13.5px]">
                {step.message}
              </p>
            </div>
          </div>

          {/* Footer: dots + Next/Start */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  aria-label={`Étape ${i + 1}`}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === index ? 20 : 6,
                    background: i === index ? 'var(--isla-cash)' : 'rgba(255,255,255,0.25)',
                  }}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl font-display font-black uppercase tracking-wide text-[13px] text-[#0a0a0b] active:scale-95 transition-transform cursor-pointer shrink-0"
              style={{ background: 'var(--isla-cash)', boxShadow: '0 6px 18px rgba(70,174,60,0.32)' }}
            >
              {isLast ? (
                <>
                  Commencer <Check size={15} />
                </>
              ) : (
                <>
                  Suivant <ChevronRight size={15} />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
