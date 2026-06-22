/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Géométrie PURE de la jaquette (mosaïque + cadrage cover/pan/zoom). Aucune
 * dépendance DOM → testable + partagée par PosterComposer, l'aperçu dev et l'export.
 */

export type Rect = { left: number; top: number; width: number; height: number }; // fractions 0..1

/**
 * Lignes de découpe INTÉRIEURES de la mosaïque (les bords 0 et 1 ne bougent jamais).
 * `x` = 3 verticales (X1<X2<X3), `y` = 5 horizontales (Y1<…<Y5). Toute coordonnée
 * répétée dans plusieurs cases pointe la MÊME entrée → le pavage reste exact quand
 * on déplace une ligne. Voir `buildCells`.
 */
export type Cuts = { x: [number, number, number]; y: [number, number, number, number, number] };

/** Découpes historiques (codées en dur jusqu'ici) → défauts rétro-compatibles. */
export const DEFAULT_CUTS: Cuts = {
  x: [0.25, 0.3333, 0.6667],
  y: [0.2, 0.3333, 0.4667, 0.6, 0.8],
};

/** Taille mini d'une case (fraction du poster) — borne les lignes intérieures. */
export const MIN_CELL = 0.06;

/**
 * Mosaïque irrégulière 9 cases (pavage EXACT de [0,1]×[0,1], façon cover GTA VI).
 * Reconstruite à partir des `cuts` : chaque arête partagée référence la MÊME ligne,
 * donc le pavage reste exact pour tout jeu de cuts valide. Avec DEFAULT_CUTS, renvoie
 * EXACTEMENT le layout historique (refactor = no-op visuel).
 */
export function buildCells(cuts: Cuts = DEFAULT_CUTS): [number, number, number, number][] {
  const [X1, X2, X3] = cuts.x;
  const [Y1, Y2, Y3, Y4, Y5] = cuts.y;
  return [
    [0, 0, X3, Y1],   // 1 horizon haut
    [X3, 0, 1, Y2],   // 2 portrait
    [0, Y1, X1, Y3],  // 3 portrait étroit
    [X1, Y1, X3, Y4], // 4 grand portrait centre
    [X3, Y2, 1, Y5],  // 5 portrait
    [X1, Y4, X3, Y5], // 6 paysage
    [0, Y3, X1, Y5],  // 7 portrait étroit
    [0, Y5, X2, 1],   // 8 paysage
    [X2, Y5, 1, 1],   // 9 horizon bas-droit
  ];
}

/** Mosaïque par défaut (DEFAULT_CUTS) — conservée pour compatibilité d'import. */
export const CELLS: [number, number, number, number][] = buildCells();

export const ASPECT = 4 / 5;        // posterW / posterH
export const DEFAULT_GUTTER = 0.015; // filet ~1.5% de la largeur (valeur historique)
const EPS = 0.001;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Borne UNE ligne intérieure entre ses voisines immédiates (les autres ne bougent
 * pas) en laissant ≥ MIN_CELL de chaque côté → aucune case ne s'écrase, pas de
 * croisement. Utilisé pendant le glissement d'une poignée.
 */
export function clampCutValue(cuts: Cuts, axis: 'x' | 'y', index: number, value: number): number {
  const arr = cuts[axis];
  const lo = (index === 0 ? 0 : arr[index - 1]) + MIN_CELL;
  const hi = (index === arr.length - 1 ? 1 : arr[index + 1]) - MIN_CELL;
  return clamp(value, lo, hi);
}

/** Normalise un axe : trie/borne chaque ligne avec ≥ MIN_CELL entre voisines et bords. */
function clampAxis(raw: number[], n: number): number[] {
  const out: number[] = [];
  let lo = MIN_CELL;
  for (let i = 0; i < n; i++) {
    const hi = 1 - MIN_CELL * (n - i);
    const v = clamp(raw[i], lo, hi);
    out.push(v);
    lo = v + MIN_CELL;
  }
  return out;
}

/** Normalise un jeu de cuts complet (sécurité au chargement) → toujours pavable. */
export function clampCuts(cuts: Cuts): Cuts {
  return {
    x: clampAxis(cuts.x, 3) as [number, number, number],
    y: clampAxis(cuts.y, 5) as [number, number, number, number, number],
  };
}

/**
 * Poignées de glissement : une par ligne intérieure, positionnée sur la couture
 * RÉELLE (le segment où la ligne est une arête de case) → elle suit le layout.
 */
export type CutHandle = { axis: 'x' | 'y'; index: number; pos: number; start: number; end: number };

export function cutHandles(cuts: Cuts = DEFAULT_CUTS): CutHandle[] {
  const [X1, X2, X3] = cuts.x;
  const [Y1, Y2, Y3, Y4, Y5] = cuts.y;
  return [
    { axis: 'x', index: 0, pos: X1, start: Y1, end: Y5 },
    { axis: 'x', index: 1, pos: X2, start: Y5, end: 1 },
    { axis: 'x', index: 2, pos: X3, start: 0, end: Y5 },
    { axis: 'y', index: 0, pos: Y1, start: 0, end: X3 },
    { axis: 'y', index: 1, pos: Y2, start: X3, end: 1 },
    { axis: 'y', index: 2, pos: Y3, start: 0, end: X1 },
    { axis: 'y', index: 3, pos: Y4, start: X1, end: X3 },
    { axis: 'y', index: 4, pos: Y5, start: 0, end: 1 },
  ];
}

/**
 * Insère le filet noir d'épaisseur `gutter` (fraction de la LARGEUR ; même épaisseur
 * en px côté vertical via *ASPECT). Demi-filet aux bords intérieurs, filet plein au
 * pourtour. SOURCE UNIQUE de la conversion fractions→cases : composer/aperçu/export.
 */
export function insetRect(
  [x0, y0, x1, y1]: [number, number, number, number],
  gutter: number = DEFAULT_GUTTER,
): Rect {
  const fx = gutter;
  const fy = gutter * ASPECT;
  const il = x0 <= EPS ? fx : fx / 2;
  const ir = x1 >= 1 - EPS ? fx : fx / 2;
  const it = y0 <= EPS ? fy : fy / 2;
  const ib = y1 >= 1 - EPS ? fy : fy / 2;
  return { left: x0 + il, top: y0 + it, width: x1 - x0 - il - ir, height: y1 - y0 - it - ib };
}

/** Rectangles des cases (fractions du poster) pour un filet et un jeu de cuts donnés. */
export function cellRects(gutter: number = DEFAULT_GUTTER, cuts: Cuts = DEFAULT_CUTS): Rect[] {
  return buildCells(cuts).map((c) => insetRect(c, gutter));
}

/** Ratio largeur/hauteur (px) d'une case (indépendant de la résolution). */
export function caseAspectOf(rect: Rect): number {
  return (rect.width / rect.height) * ASPECT;
}

/** Défauts (gutter = DEFAULT_GUTTER) — utilisés par l'aperçu et les tests. */
export const CELL_RECTS: Rect[] = cellRects();
export const CASE_ASPECT: number[] = CELL_RECTS.map(caseAspectOf);

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
