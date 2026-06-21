/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * APERÇU DEV-ONLY de la jaquette (gaté ?poster=1 + import.meta.env.DEV dans main.tsx).
 * Pré-remplit les 9 cases avec des photos d'orientations variées pour visualiser le
 * recadrage cover + les filets sans rien placer à la main. Réutilise la VRAIE
 * géométrie (CELL_RECTS + placePhoto) → reflète exactement le rendu réel. À retirer :
 * supprimer ce fichier + la branche dans main.tsx. Aucun impact prod.
 */

import { useState } from 'react';
import logoUrl from '../assets/logo-gta-isla-primavera.png';
import { CELL_RECTS, CASE_ASPECT, placePhoto } from '../utils/posterGeometry';
import { DEFAULT_POSTER_LOGO } from '../utils/storage';

const POSTER_BG = '#0A0A0D';

// 9 photos picsum, orientations VARIÉES (paysage / portrait / carré / extrêmes)
// pour voir le cover dans chaque type de case.
const PREVIEW_PHOTOS = [
  'https://picsum.photos/seed/ip-h1/1600/720',  // 1 horizon → très large
  'https://picsum.photos/seed/ip-p2/900/1500',  // 2 portrait
  'https://picsum.photos/seed/ip-p3/800/1600',  // 3 portrait étroit → très haut
  'https://picsum.photos/seed/ip-sq4/1300/1300', // 4 grand centre → carré
  'https://picsum.photos/seed/ip-p5/1000/1500',  // 5 portrait
  'https://picsum.photos/seed/ip-l6/1600/1000',  // 6 paysage
  'https://picsum.photos/seed/ip-p7/820/1600',   // 7 portrait étroit
  'https://picsum.photos/seed/ip-l8/1500/1050',  // 8 paysage
  'https://picsum.photos/seed/ip-h9/1600/760',   // 9 horizon → large
];

export default function PosterPreview() {
  const [ratios, setRatios] = useState<Record<number, number>>({});
  const logo = DEFAULT_POSTER_LOGO;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center gap-4 py-6 px-4">
      <div className="text-center">
        <p className="font-display font-black uppercase tracking-wide text-sm">Aperçu jaquette (dev)</p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-white/50">
          9 cases pré-remplies · photos picsum variées · CELL_RECTS + placePhoto réels
        </p>
      </div>

      <div
        className="relative w-full max-w-[360px] aspect-[4/5] overflow-hidden border border-white/10"
        style={{ background: POSTER_BG, boxShadow: '0 20px 50px rgba(0,0,0,.6)' }}
      >
        {CELL_RECTS.map((r, i) => {
          const ratio = ratios[i];
          const g = ratio !== undefined ? placePhoto(CASE_ASPECT[i], ratio, 1, 0, 0) : null;
          return (
            <div
              key={i}
              className="absolute overflow-hidden"
              style={{
                left: `${r.left * 100}%`,
                top: `${r.top * 100}%`,
                width: `${r.width * 100}%`,
                height: `${r.height * 100}%`,
              }}
            >
              {g ? (
                <img
                  src={PREVIEW_PHOTOS[i]}
                  alt=""
                  className="absolute max-w-none"
                  style={{
                    left: `${g.leftPct}%`,
                    top: `${g.topPct}%`,
                    width: `${g.drawWpct}%`,
                    height: `${g.drawHpct}%`,
                  }}
                />
              ) : (
                <img
                  src={PREVIEW_PHOTOS[i]}
                  alt=""
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    if (el.naturalWidth > 0) setRatios((p) => ({ ...p, [i]: el.naturalHeight / el.naturalWidth }));
                  }}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
            </div>
          );
        })}

        {/* Logo libre à sa position/taille par défaut */}
        <div
          className="absolute"
          style={{ left: `${logo.x * 100}%`, top: `${logo.y * 100}%`, width: `${logo.w * 100}%`, transform: 'translate(-50%, -50%)' }}
        >
          <div
            className="absolute"
            style={{ inset: '-14% -10%', background: 'radial-gradient(closest-side, rgba(0,0,0,.55), transparent 75%)', filter: 'blur(6px)' }}
          />
          <img src={logoUrl} alt="" className="relative w-full drop-shadow-[0_3px_10px_rgba(0,0,0,.7)]" />
        </div>
      </div>

      <p className="font-mono text-[10px] text-white/40 max-w-[360px] text-center">
        Chaque case clippe sa photo en cover (filets noirs ~1,5%). Recharge pour d'autres
        photos (seeds picsum fixes ici). Nécessite un accès réseau (picsum.photos).
      </p>
    </div>
  );
}
