import { useEffect, useState } from "react";

/**
 * SplashScreen — « Grand Tenerife Auto : Isla Primavera »
 *
 * Splash plein écran (image /assets/splash.webp en object-cover) + overlay de
 * chargement style GTA VI (handoff Claude Design) + animation du logo (balayage
 * chromé « sheen » qui passe une fois sur la bande du logo).
 *
 * Contrat conservé : affichage HOLD_MS, fondu de sortie FADE_MS, puis onComplete().
 * Respecte prefers-reduced-motion et les safe-area insets (mobile-first).
 *
 * Polices requises dans index.html (Google Fonts) :
 *   Oswald (600,700) + Barlow Semi Condensed (500,600).
 */

const HOLD_MS = 2200; // durée d'affichage avant la sortie
const FADE_MS = 500; // fondu de sortie

type Props = { onComplete?: () => void };

export default function SplashScreen({ onComplete }: Props) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setLeaving(true), HOLD_MS);
    const t2 = window.setTimeout(() => onComplete?.(), HOLD_MS + FADE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onComplete]);

  return (
    <div
      className={`gtaip-splash${leaving ? " is-leaving" : ""}`}
      role="status"
      aria-label="Chargement"
    >
      <img className="gtaip-bg" src="/assets/splash.webp" alt="" />

      {/* Animation du logo : balayage chromé sur la bande du logo */}
      <div className="gtaip-sheen" aria-hidden="true">
        <span />
      </div>

      {/* Overlay de chargement (Claude Design) */}
      <div className="gtaip-overlay" aria-hidden="true">
        <div className="ld-readability" />
        <div className="ld-vignette" />
        <div className="ld-grain" />

        <div className="ld-tip">
          <div className="ld-tip-head">
            <span className="ld-dot" />
            <span className="ld-tip-label">ASTUCE</span>
          </div>
          <div className="ld-tip-body">
            Sur Isla Primavera, le coucher de soleil n'attend personne. Roulez
            vite, vivez lentement.
          </div>
        </div>

        <div className="ld-load">
          <div className="ld-load-txt">
            <div className="ld-load-label">CHARGEMENT</div>
            <div className="ld-load-sub">ISLA PRIMAVERA · TENERIFE</div>
          </div>
          <div className="ld-spinner">
            <svg className="ld-spin-out" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="7" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#fdfbf6" strokeWidth="7" strokeLinecap="round" strokeDasharray="56 195" />
            </svg>
            <svg className="ld-spin-in" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="27" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray="20 150" />
            </svg>
          </div>
        </div>

        <div className="ld-track">
          <div className="ld-fill" />
        </div>
      </div>

      <style>{`
        .gtaip-splash{
          position:fixed; inset:0; z-index:10000;
          background:#0B0C10; overflow:hidden;
          --accent:#c14dff;
          opacity:1;
          animation:gtaipIn .6s ease;
          transition:opacity ${FADE_MS}ms ease;
          font-family:'Barlow Semi Condensed','Inter',system-ui,sans-serif;
        }
        .gtaip-splash.is-leaving{ opacity:0; }

        .gtaip-bg{
          position:absolute; inset:0; width:100%; height:100%;
          object-fit:cover; object-position:center; display:block;
        }

        /* ---- animation logo : sheen ---- */
        .gtaip-sheen{
          position:absolute; left:0; right:0; top:37%; height:19%;
          overflow:hidden; pointer-events:none; mix-blend-mode:screen;
        }
        .gtaip-sheen span{
          position:absolute; top:-30%; bottom:-30%; left:0; width:42%;
          transform:translateX(-180%) skewX(-18deg);
          background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.0) 25%,rgba(255,255,255,.6) 50%,rgba(255,255,255,0) 75%,transparent 100%);
          animation:gtaipSheen 1.25s cubic-bezier(.4,0,.2,1) .55s 1 both;
        }

        /* ---- overlay Claude Design ---- */
        .gtaip-overlay{ position:absolute; inset:0; pointer-events:none; }

        .ld-readability{ position:absolute; inset:0;
          background:linear-gradient(180deg,rgba(8,5,18,0) 70%,rgba(8,5,18,.78) 100%); }
        .ld-vignette{ position:absolute; inset:0;
          background:radial-gradient(132% 102% at 50% 46%,transparent 58%,rgba(10,5,26,.5) 100%); }
        .ld-grain{ position:absolute; inset:-30%; opacity:.07; mix-blend-mode:overlay;
          animation:grain .55s steps(1) infinite;
          background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='120' height='120' filter='url(%23n)'/></svg>"); }

        .ld-tip{ position:absolute; left:4%;
          bottom:calc(6.5% + env(safe-area-inset-bottom,0px)); max-width:54%;
          animation:fadeIn 1s ease both; }
        .ld-tip-head{ display:inline-flex; align-items:center; gap:8px; margin-bottom:7px; }
        .ld-dot{ width:8px; height:8px; border-radius:50%; background:var(--accent);
          box-shadow:0 0 9px var(--accent); }
        .ld-tip-label{ font-family:'Oswald','Space Grotesk',sans-serif; font-weight:600;
          font-size:clamp(10px,1.6vw,13px); letter-spacing:4px; color:var(--accent);
          text-shadow:0 2px 6px rgba(0,0,0,.8); }
        .ld-tip-body{ font-weight:500; font-size:clamp(13px,2.2vw,18px); line-height:1.25;
          color:#f3edf5; text-shadow:0 2px 8px rgba(0,0,0,.9); }

        .ld-load{ position:absolute; right:4%;
          bottom:calc(6% + env(safe-area-inset-bottom,0px));
          display:flex; align-items:center; gap:14px; animation:fadeIn 1s ease both; }
        .ld-load-txt{ text-align:right; }
        .ld-load-label{ font-family:'Oswald','Space Grotesk',sans-serif; font-weight:700;
          font-size:clamp(13px,2.4vw,18px); letter-spacing:4px; color:#fdfbf6;
          text-shadow:0 2px 8px rgba(0,0,0,.9); }
        .ld-load-sub{ font-weight:500; font-size:clamp(10px,1.8vw,14px); letter-spacing:2px;
          color:#d9cbdb; margin-top:3px; text-shadow:0 2px 6px rgba(0,0,0,.8); }
        .ld-spinner{ position:relative; width:clamp(42px,7vw,60px); aspect-ratio:1; }
        .ld-spinner svg{ position:absolute; inset:0; width:100%; height:100%; }
        .ld-spin-out{ animation:spin 1.15s linear infinite; filter:drop-shadow(0 2px 6px rgba(0,0,0,.6)); }
        .ld-spin-in{ animation:spinrev 1.7s linear infinite; }

        .ld-track{ position:absolute; left:0; right:0;
          bottom:env(safe-area-inset-bottom,0px); height:5px; background:rgba(255,255,255,.1); }
        .ld-fill{ height:100%; width:0%;
          background:linear-gradient(90deg,var(--accent),#ff8a4e,#fdfbf6);
          box-shadow:0 0 12px var(--accent);
          animation:gtaipBar ${HOLD_MS}ms cubic-bezier(.4,0,.2,1) both; }

        /* ---- keyframes ---- */
        @keyframes gtaipIn{ from{opacity:0; transform:scale(1.04)} to{opacity:1; transform:scale(1)} }
        @keyframes gtaipSheen{ from{transform:translateX(-180%) skewX(-18deg)} to{transform:translateX(560%) skewX(-18deg)} }
        @keyframes gtaipBar{ from{width:0%} to{width:100%} }
        @keyframes spin{ to{transform:rotate(360deg)} }
        @keyframes spinrev{ to{transform:rotate(-360deg)} }
        @keyframes grain{ 0%{transform:translate(0,0)} 20%{transform:translate(-8%,3%)} 40%{transform:translate(-3%,8%)} 60%{transform:translate(6%,2%)} 80%{transform:translate(5%,-5%)} 100%{transform:translate(0,0)} }
        @keyframes fadeIn{ from{opacity:0} to{opacity:1} }

        /* ---- accessibilité : mouvement réduit ---- */
        @media (prefers-reduced-motion: reduce){
          .gtaip-splash{ animation:none; transition:opacity .2s ease; }
          .gtaip-sheen{ display:none; }
          .ld-grain{ animation:none; opacity:.05; }
          .ld-spin-out,.ld-spin-in{ animation:none; }
          .ld-tip,.ld-load{ animation:none; }
          .ld-fill{ animation:none; width:100%; }
        }
      `}</style>
    </div>
  );
}
