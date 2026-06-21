/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Géométrie PURE de la jaquette (mosaïque + cadrage cover/pan/zoom). Aucune
 * dépendance DOM → testable + partagée par PosterComposer, l'aperçu dev et l'export.
 */

export type Rect = { left: number; top: number; width: number; height: number }; // fractions 0..1

/** Mosaïque irrégulière 9 cases (pavage EXACT de [0,1]×[0,1], façon cover GTA VI). */
export const CELLS: [number, number, number, number][] = [
  [0.0, 0.0, 0.6667, 0.2],     // 1 horizon haut
  [0.6667, 0.0, 1.0, 0.3333],  // 2 portrait
  [0.0, 0.2, 0.25, 0.4667],    // 3 portrait étroit
  [0.25, 0.2, 0.6667, 0.6],    // 4 grand portrait centre
  [0.6667, 0.3333, 1.0, 0.8],  // 5 portrait
  [0.25, 0.6, 0.6667, 0.8],    // 6 paysage
  [0.0, 0.4667, 0.25, 0.8],    // 7 portrait étroit
  [0.0, 0.8, 0.3333, 1.0],     // 8 paysage
  [0.3333, 0.8, 1.0, 1.0],     // 9 horizon bas-droit
];

export const ASPECT = 4 / 5;             // posterW / posterH
export const FILET_X = 0.015;            // filet ~1.5% de la largeur
export const FILET_Y = FILET_X * ASPECT; // même épaisseur en px (fraction de la hauteur)
const EPS = 0.001;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Insère le filet noir : demi-filet aux bords intérieurs, filet plein au pourtour. */
export function insetRect([x0, y0, x1, y1]: [number, number, number, number]): Rect {
  const il = x0 <= EPS ? FILET_X : FILET_X / 2;
  const ir = x1 >= 1 - EPS ? FILET_X : FILET_X / 2;
  const it = y0 <= EPS ? FILET_Y : FILET_Y / 2;
  const ib = y1 >= 1 - EPS ? FILET_Y : FILET_Y / 2;
  return { left: x0 + il, top: y0 + it, width: x1 - x0 - il - ir, height: y1 - y0 - it - ib };
}

/** Rectangles des cases avec filets (fractions du poster). */
export const CELL_RECTS: Rect[] = CELLS.map(insetRect);

/** Ratio largeur/hauteur (px) de chaque case (indépendant de la résolution). */
export const CASE_ASPECT: number[] = CELL_RECTS.map((r) => (r.width / r.height) * ASPECT);

export type Placement = {
  drawWpct: number; // largeur de la photo, % de la case
  drawHpct: number; // hauteur de la photo, % de la case
  leftPct: number;  // décalage gauche, % de la case
  topPct: number;   // décalage haut, % de la case
  overW: number;    // débordement horizontal (drawWpct - 100)
  overH: number;    // débordement vertical (drawHpct - 100)
};

/**
 * Placement d'une photo dans une case : object-fit COVER + zoom (scale ≥ 1) + pan
 * (offX/offY normalisés ∈ [-1,1]). Mêmes maths à l'écran ET sur le canvas d'export.
 * `caseAspect` = largeur/hauteur (px) de la case ; `ratio` = hNaturelle/wNaturelle.
 * INVARIANT : pour scale ≥ 1 et offX,offY ∈ [-1,1], la photo couvre toute la case
 * (le rect rendu contient [0,100]² — jamais de vide/letterbox).
 */
export function placePhoto(caseAspect: number, ratio: number, scale: number, offX: number, offY: number): Placement {
  const imageAspect = 1 / ratio; // largeur/hauteur de la photo
  let drawWpct: number;
  let drawHpct: number;
  if (imageAspect >= caseAspect) {
    drawHpct = 100 * scale;
    drawWpct = (imageAspect / caseAspect) * 100 * scale;
  } else {
    drawWpct = 100 * scale;
    drawHpct = (caseAspect / imageAspect) * 100 * scale;
  }
  const overW = drawWpct - 100;
  const overH = drawHpct - 100;
  const leftPct = (overW / 2) * (offX - 1);
  const topPct = (overH / 2) * (offY - 1);
  return { drawWpct, drawHpct, leftPct, topPct, overW, overH };
}
