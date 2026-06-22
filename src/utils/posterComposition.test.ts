import { describe, it, expect } from 'vitest';
import {
  parsePosterComposition,
  DEFAULT_POSTER_LOGO,
  DEFAULT_SLOT_TRANSFORM,
  DEFAULT_GUTTER,
  DEFAULT_CUTS,
  type PosterComposition,
} from './storage';

describe('parsePosterComposition — round-trip + rétro-compat', () => {
  it('round-trip : state → JSON.stringify → parse === state', () => {
    const state: PosterComposition = {
      slots: Array.from({ length: 9 }, (_, i) => ({
        photoId: i % 2 === 0 ? `course:run-${i}` : i === 1 ? null : `loc:${i}`,
        transform: { scale: 1 + i * 0.1, offsetX: i / 10 - 0.4, offsetY: 0.5 - i / 12 },
      })),
      logo: { x: 0.42, y: 0.18, w: 0.73 },
      gutter: 0.022,
      // cuts valides (ordonnés, ≥ MIN_CELL) → clampCuts est un no-op → round-trip exact.
      cuts: { x: [0.2, 0.4, 0.7], y: [0.15, 0.32, 0.5, 0.66, 0.82] },
    };
    const round = parsePosterComposition(JSON.parse(JSON.stringify(state)));
    expect(round).toEqual(state);
    expect(round.slots).toHaveLength(9);
    expect(round.gutter).toBe(0.022);
    expect(round.cuts).toEqual(state.cuts);
  });

  it('rétro-compat : ancien tableau d’ids seuls → cover par défaut + logo défaut', () => {
    const old = ['course:a', null, 'loc:5'];
    const comp = parsePosterComposition(old);
    expect(comp.slots).toHaveLength(9);
    expect(comp.slots[0]).toEqual({ photoId: 'course:a', transform: DEFAULT_SLOT_TRANSFORM });
    expect(comp.slots[1].photoId).toBeNull();
    expect(comp.slots[2]).toEqual({ photoId: 'loc:5', transform: DEFAULT_SLOT_TRANSFORM });
    expect(comp.slots[8].photoId).toBeNull();
    expect(comp.logo).toEqual(DEFAULT_POSTER_LOGO);
    expect(comp.gutter).toBe(DEFAULT_GUTTER); // gutter absent → défaut
  });

  it('rétro-compat : ancien { slots: ids, logo } → cases normalisées + logo conservé', () => {
    const old = { slots: ['a', null, 'b'], logo: { x: 0.5, y: 0.1, w: 0.9 } };
    const comp = parsePosterComposition(old);
    expect(comp.slots).toHaveLength(9);
    expect(comp.slots[0]).toEqual({ photoId: 'a', transform: DEFAULT_SLOT_TRANSFORM });
    expect(comp.slots[2]).toEqual({ photoId: 'b', transform: DEFAULT_SLOT_TRANSFORM });
    expect(comp.logo).toEqual({ x: 0.5, y: 0.1, w: 0.9 });
    expect(comp.gutter).toBe(DEFAULT_GUTTER); // gutter absent → défaut
  });

  it('logo partiel → complété par les valeurs par défaut', () => {
    const comp = parsePosterComposition({ slots: [], logo: { w: 0.4 } });
    expect(comp.logo).toEqual({ ...DEFAULT_POSTER_LOGO, w: 0.4 });
  });

  it('gutter fourni est conservé ; gutter non-numérique → défaut', () => {
    expect(parsePosterComposition({ slots: [], logo: {}, gutter: 0.03 }).gutter).toBe(0.03);
    expect(parsePosterComposition({ slots: [], logo: {}, gutter: 'big' }).gutter).toBe(DEFAULT_GUTTER);
  });

  it('cuts absent → DEFAULT_CUTS (rétro-compat des compositions sans cuts)', () => {
    expect(parsePosterComposition(['a', null, 'b']).cuts).toEqual(DEFAULT_CUTS);
    expect(parsePosterComposition({ slots: [], logo: {} }).cuts).toEqual(DEFAULT_CUTS);
    expect(parsePosterComposition({ slots: [], logo: {}, gutter: 0.02 }).cuts).toEqual(DEFAULT_CUTS);
  });

  it('cuts fourni valide est conservé (clampCuts no-op) ; cuts invalide → DEFAULT_CUTS', () => {
    const good = { x: [0.2, 0.4, 0.7], y: [0.15, 0.32, 0.5, 0.66, 0.82] };
    expect(parsePosterComposition({ slots: [], logo: {}, cuts: good }).cuts).toEqual(good);
    // Mauvaise longueur / non-numérique / type → défaut.
    for (const bad of [
      { x: [0.2, 0.4], y: [0.1, 0.2, 0.3, 0.4, 0.5] }, // x trop court
      { x: [0.2, 0.4, 0.7], y: [0.1, 0.2, 0.3] },       // y trop court
      { x: [0.2, 'x', 0.7], y: [0.1, 0.2, 0.3, 0.4, 0.5] }, // non-numérique
      { x: [0.2, NaN, 0.7], y: [0.1, 0.2, 0.3, 0.4, 0.5] }, // NaN
      'nope',
      42,
    ]) {
      expect(parsePosterComposition({ slots: [], logo: {}, cuts: bad }).cuts).toEqual(DEFAULT_CUTS);
    }
  });

  it('cuts hors-bornes est borné (clampCuts) → toujours pavable, jamais identité folle', () => {
    const comp = parsePosterComposition({ slots: [], logo: {}, cuts: { x: [0.9, 0.1, 0.5], y: [2, 2, 2, 2, 2] } });
    // ordonné + écarté, donc différent de l'entrée folle et valide.
    expect(comp.cuts.x[0]).toBeLessThan(comp.cuts.x[1]);
    expect(comp.cuts.x[1]).toBeLessThan(comp.cuts.x[2]);
    expect(comp.cuts.y.every((v, i) => i === 0 || v > comp.cuts.y[i - 1])).toBe(true);
  });

  it('transform partielle / corrompue → valeurs par défaut, pas de crash', () => {
    const comp = parsePosterComposition({
      slots: [{ photoId: 'x', transform: { scale: 2 } }, { photoId: 5, transform: 'nope' }],
      logo: {},
    });
    expect(comp.slots[0]).toEqual({ photoId: 'x', transform: { scale: 2, offsetX: 0, offsetY: 0 } });
    expect(comp.slots[1].photoId).toBeNull(); // id non-string → null
    expect(comp.slots[1].transform).toEqual(DEFAULT_SLOT_TRANSFORM);
  });

  it('null / garbage → 9 cases vides + logo défaut (pas de crash)', () => {
    for (const junk of [null, undefined, 42, 'oops', {}]) {
      const comp = parsePosterComposition(junk);
      expect(comp.slots).toHaveLength(9);
      expect(comp.slots.every((s) => s.photoId === null)).toBe(true);
      expect(comp.logo).toEqual(DEFAULT_POSTER_LOGO);
    }
  });
});
