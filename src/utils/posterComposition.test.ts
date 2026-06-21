import { describe, it, expect } from 'vitest';
import {
  parsePosterComposition,
  DEFAULT_POSTER_LOGO,
  DEFAULT_SLOT_TRANSFORM,
  DEFAULT_GUTTER,
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
    };
    const round = parsePosterComposition(JSON.parse(JSON.stringify(state)));
    expect(round).toEqual(state);
    expect(round.slots).toHaveLength(9);
    expect(round.gutter).toBe(0.022);
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
