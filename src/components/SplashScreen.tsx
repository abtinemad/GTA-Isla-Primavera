/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface SplashScreenProps {
  onComplete: () => void;
}

/**
 * Boot splash — affiche l'artwork GTA déjà titré (« GRAND TENERIFE AUTO /
 * Isla Primavera » baké dans l'image), centré et entier (object-contain) sur
 * fond #0B0C10. Aucun wordmark / dédicace en overlay : tout est dans
 * l'illustration. Se rejoue à chaque chargement.
 */
export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(onComplete, reduceMotion ? 1400 : 2200);
    return () => clearTimeout(timer);
  }, [onComplete, reduceMotion]);

  return (
    <motion.div
      // Fond app : évite tout flash et fait office de letterbox autour de l'image.
      className="fixed inset-0 z-[10000] bg-[#0B0C10] overflow-hidden flex items-center justify-center"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
      }}
    >
      <img
        src="/assets/splash.webp"
        alt="Grand Tenerife Auto : Isla Primavera"
        loading="eager"
        fetchPriority="high"
        // Plein écran sans bandes : couvre tout l'overlay (rogne si besoin).
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Discret indicateur de chargement (safe-area bas). Supprimable d'un bloc. */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-center pb-8 pt-10 bg-gradient-to-t from-black/45 to-transparent pointer-events-none"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
      >
        <span className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[3px] text-white/70">
          Chargement
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={reduceMotion ? undefined : { opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
            >
              .
            </motion.span>
          ))}
        </span>
      </div>
    </motion.div>
  );
}
