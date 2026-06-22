import { describe, it, expect } from 'vitest';
import {
  CELLS,
  CASE_ASPECT,
  placePhoto,
  clamp,
  cellRects,
  caseAspectOf,
  buildCells,
  clampCuts,
  clampCutValue,
  DEFAULT_CUTS,
  MIN_CELL,
  type Cuts,
} from './posterGeometry';

// Pavage exact : chaque point d'une grille fine couvert exactement une fois + aires = 1.
function tilingStats(cells: [number, number, number, number][], N = 200) {
  let holes = 0;
  let overlaps = 0;
  let area = 0;
  for (const [x0, y0, x1, y1] of cells) area += (x1 - x0) * (y1 - y0);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const px = (i + 0.5) / N;
      const py = (j + 0.5) / N;
      let count = 0;
      for (const [x0, y0, x1, y1] of cells) {
        if (px >= x0 && px < x1 && py >= y0 && py < y1) count++;
      }
      if (count === 0) holes++;
      else if (count > 1) overlaps++;
    }
  }
  return { holes, overlaps, area };
}

describe('CELLS — mosaïque 9 cases', () => {
  it('a exactement 9 cases', () => {
    expect(CELLS).toHaveLength(9);
  });

  it('chaque case est valide : x0<x1, y0<y1, dans [0,1]', () => {
    for (const [x0, y0, x1, y1] of CELLS) {
      expect(x0).toBeGreaterThanOrEqual(0);
      expect(y0).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(1);
      expect(y1).toBeLessThanOrEqual(1);
      expect(x1).toBeGreaterThan(x0);
      expect(y1).toBeGreaterThan(y0);
    }
  });

  it('somme des aires = 1', () => {
    const area = CELLS.reduce((s, [x0, y0, x1, y1]) => s + (x1 - x0) * (y1 - y0), 0);
    expect(area).toBeCloseTo(1, 6);
  });

  it('pavage EXACT : chaque point d’une grille fine 200×200 couvert exactement 1 fois', () => {
    const N = 200;
    let holes = 0;
    let overlaps = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const px = (i + 0.5) / N;
        const py = (j + 0.5) / N;
        let count = 0;
        for (const [x0, y0, x1, y1] of CELLS) {
          if (px >= x0 && px < x1 && py >= y0 && py < y1) count++;
        }
        if (count === 0) holes++;
        else if (count > 1) overlaps++;
      }
    }
    expect(holes).toBe(0);
    expect(overlaps).toBe(0);
  });

  it('une case horizon (aspect ≥ 2) au coin bas-droit contient (0.99, 0.99)', () => {
    const cell = CELLS.find(([x0, y0, x1, y1]) => 0.99 >= x0 && 0.99 < x1 && 0.99 >= y0 && 0.99 < y1);
    expect(cell).toBeDefined();
    const [x0, y0, x1, y1] = cell!;
    const aspect = (x1 - x0) / (y1 - y0);
    expect(aspect).toBeGreaterThanOrEqual(2);
  });
});

describe('Cuts — barres intérieures redimensionnables (pavage préservé)', () => {
  // Copie LITTÉRALE du layout historique (avant paramétrage). Sert d'oracle no-op.
  const HISTORIQUE: [number, number, number, number][] = [
    [0.0, 0.0, 0.6667, 0.2],
    [0.6667, 0.0, 1.0, 0.3333],
    [0.0, 0.2, 0.25, 0.4667],
    [0.25, 0.2, 0.6667, 0.6],
    [0.6667, 0.3333, 1.0, 0.8],
    [0.25, 0.6, 0.6667, 0.8],
    [0.0, 0.4667, 0.25, 0.8],
    [0.0, 0.8, 0.3333, 1.0],
    [0.3333, 0.8, 1.0, 1.0],
  ];

  it('(1) avec DEFAULT_CUTS, buildCells() == le layout historique (refactor no-op)', () => {
    expect(buildCells()).toEqual(HISTORIQUE);
    expect(buildCells(DEFAULT_CUTS)).toEqual(HISTORIQUE);
  });

  it('(1bis) cellRects() inchangé == cellRects(gutter, DEFAULT_CUTS)', () => {
    expect(cellRects()).toEqual(cellRects(0.015, DEFAULT_CUTS));
    expect(CELLS).toEqual(HISTORIQUE);
  });

  it('(2) un jeu de cuts perturbé valide pave EXACTEMENT [0,1]² (aires=1, ni trou ni chevauchement)', () => {
    const perturbed: Cuts[] = [
      { x: [0.18, 0.42, 0.55], y: [0.13, 0.4, 0.52, 0.66, 0.86] },
      { x: [0.35, 0.5, 0.78], y: [0.1, 0.22, 0.55, 0.7, 0.75] },
      { x: [0.1, 0.2, 0.9], y: [0.08, 0.3, 0.5, 0.72, 0.9] },
    ];
    for (const cuts of perturbed) {
      const cells = buildCells(clampCuts(cuts));
      const { holes, overlaps, area } = tilingStats(cells);
      expect(holes).toBe(0);
      expect(overlaps).toBe(0);
      expect(area).toBeCloseTo(1, 6);
      // Aucune case écrasée.
      for (const [x0, y0, x1, y1] of cells) {
        expect(x1 - x0).toBeGreaterThan(0);
        expect(y1 - y0).toBeGreaterThan(0);
      }
    }
  });

  it('clampCuts : défauts inchangés (déjà valides) + ordre/espacement garantis sur entrée folle', () => {
    expect(clampCuts(DEFAULT_CUTS)).toEqual(DEFAULT_CUTS);
    const wild = clampCuts({ x: [0.9, 0.1, 0.5], y: [-1, -1, -1, 2, 2] });
    const ascending = (a: number[]) => a.every((v, i) => i === 0 || v - a[i - 1] >= MIN_CELL - 1e-9);
    expect(ascending(wild.x)).toBe(true);
    expect(ascending(wild.y)).toBe(true);
    expect(wild.x[0]).toBeGreaterThanOrEqual(MIN_CELL - 1e-9);
    expect(wild.y[4]).toBeLessThanOrEqual(1 - MIN_CELL + 1e-9);
    expect(buildCells(wild).every(([x0, y0, x1, y1]) => x1 > x0 && y1 > y0)).toBe(true);
  });

  it('clampCutValue : une ligne reste bornée entre ses voisines (≥ MIN_CELL), voisines fixes', () => {
    // y index 2 (Y3=0.4667) borné entre Y2=0.3333 et Y4=0.6.
    expect(clampCutValue(DEFAULT_CUTS, 'y', 2, 0.99)).toBeCloseTo(0.6 - MIN_CELL, 9);
    expect(clampCutValue(DEFAULT_CUTS, 'y', 2, -0.5)).toBeCloseTo(0.3333 + MIN_CELL, 9);
    // x index 0 (X1) borné entre le bord 0 et X2.
    expect(clampCutValue(DEFAULT_CUTS, 'x', 0, 0)).toBeCloseTo(MIN_CELL, 9);
    expect(clampCutValue(DEFAULT_CUTS, 'x', 2, 5)).toBeCloseTo(1 - MIN_CELL, 9);
  });
});

describe('placePhoto — cover + pan/zoom : JAMAIS de vide', () => {
  // ratio = hauteurNaturelle / largeurNaturelle.
  const RATIOS = {
    tresPortrait: 2.5, // image très haute
    carre: 1,
    tresPaysage: 0.4, // image très large
  };
  const SCALES = [1, 1.5, 2, 3];
  const OFFSETS = [-1, 0, 1];
  // Cases réelles + aspects extrêmes (très large / carré / très haut).
  const ASPECTS = [...CASE_ASPECT, 0.4, 1, 2.6];
  const EPS = 1e-6;

  const covers = (p: ReturnType<typeof placePhoto>) =>
    p.leftPct <= EPS &&
    p.leftPct + p.drawWpct >= 100 - EPS &&
    p.topPct <= EPS &&
    p.topPct + p.drawHpct >= 100 - EPS;

  it('couvre toute la case pour tout ratio × scale × offset ∈ [-1,1]', () => {
    let fails = 0;
    for (const caseAspect of ASPECTS) {
      for (const ratio of Object.values(RATIOS)) {
        for (const scale of SCALES) {
          for (const ox of OFFSETS) {
            for (const oy of OFFSETS) {
              const p = placePhoto(caseAspect, ratio, scale, ox, oy);
              if (!covers(p)) fails++;
            }
          }
        }
      }
    }
    expect(fails).toBe(0);
  });

  it('un offset hors-limite, une fois CLAMPÉ, couvre encore (clamp ∈ [-1,1])', () => {
    expect(clamp(1.5, -1, 1)).toBe(1);
    expect(clamp(-3, -1, 1)).toBe(-1);
    let fails = 0;
    for (const caseAspect of ASPECTS) {
      for (const ratio of Object.values(RATIOS)) {
        for (const scale of SCALES) {
          for (const raw of [-5, -1.5, 1.5, 5]) {
            const p = placePhoto(caseAspect, ratio, scale, clamp(raw, -1, 1), clamp(raw, -1, 1));
            if (!covers(p)) fails++;
          }
        }
      }
    }
    expect(fails).toBe(0);
  });

  it('SANS clamp, un offset hors-limite révèle un trou (justifie le clamp)', () => {
    const p = placePhoto(0.4, 1, 2, 1.5, 0); // offX > 1, zoom → overflow réel
    expect(p.leftPct).toBeGreaterThan(0); // bord gauche découvert
  });
});

describe('Filets réglables (gutter) — cover toujours garanti + cases valides', () => {
  // 0 %, 1,5 % (défaut), 4 % (max du slider).
  const GUTTERS = [0, 0.015, 0.04];
  const RATIOS = [2.5, 1, 0.4]; // très portrait / carré / très paysage
  const SCALES = [1, 1.5, 2, 3];
  const OFFSETS = [-1, 0, 1];
  const EPS = 1e-6;

  it('chaque gutter produit 9 cases de dimensions strictement positives', () => {
    for (const gutter of GUTTERS) {
      const rects = cellRects(gutter);
      expect(rects).toHaveLength(9);
      for (const r of rects) {
        expect(r.width).toBeGreaterThan(0);
        expect(r.height).toBeGreaterThan(0);
      }
    }
  });

  it('placePhoto couvre toute case (jamais de vide) pour 0 % / 1,5 % / 4 %', () => {
    let fails = 0;
    for (const gutter of GUTTERS) {
      // caseAspect recalculé depuis le RECT RÉEL de chaque case (dépend du gutter).
      const aspects = cellRects(gutter).map(caseAspectOf);
      for (const ca of aspects) {
        for (const ratio of RATIOS) {
          for (const scale of SCALES) {
            for (const ox of OFFSETS) {
              for (const oy of OFFSETS) {
                const p = placePhoto(ca, ratio, scale, ox, oy);
                const covers =
                  p.leftPct <= EPS &&
                  p.leftPct + p.drawWpct >= 100 - EPS &&
                  p.topPct <= EPS &&
                  p.topPct + p.drawHpct >= 100 - EPS;
                if (!covers) fails++;
              }
            }
          }
        }
      }
    }
    expect(fails).toBe(0);
  });

  it('gutter par défaut (1,5 %) == CASE_ASPECT exporté', () => {
    expect(cellRects(0.015).map(caseAspectOf)).toEqual(CASE_ASPECT);
  });
});
