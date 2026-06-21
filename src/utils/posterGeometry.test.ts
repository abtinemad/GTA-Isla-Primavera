import { describe, it, expect } from 'vitest';
import { CELLS, CASE_ASPECT, placePhoto, clamp } from './posterGeometry';

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
