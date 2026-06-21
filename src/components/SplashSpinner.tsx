/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Loader repris de l'écran de démarrage (GTA VI) : double anneau chromé +
 * label « CHARGEMENT ». Réutilisé en surimpression d'un panel le temps que son
 * illustration se charge. Animation désactivée si prefers-reduced-motion.
 */
export default function SplashSpinner({ size = 40, label }: { size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 select-none pointer-events-none">
      <div className="splash-spinner" style={{ width: size, height: size }}>
        <svg className="ss-out" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="7" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#fdfbf6"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray="56 195"
          />
        </svg>
        <svg className="ss-in" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="27"
            fill="none"
            stroke="#c14dff"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="20 150"
          />
        </svg>
      </div>
      {label && (
        <span className="font-mono font-black uppercase tracking-[3px] text-white/75" style={{ fontSize: 9 }}>
          {label}
        </span>
      )}
      <style>{`
        .splash-spinner{position:relative}
        .splash-spinner svg{position:absolute;inset:0;width:100%;height:100%}
        .ss-out{animation:ssSpin 1.15s linear infinite;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))}
        .ss-in{animation:ssSpinRev 1.7s linear infinite}
        @keyframes ssSpin{to{transform:rotate(360deg)}}
        @keyframes ssSpinRev{to{transform:rotate(-360deg)}}
        @media (prefers-reduced-motion: reduce){
          .ss-out,.ss-in{animation:none}
        }
      `}</style>
    </div>
  );
}
