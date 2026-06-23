import { describe, it, expect, vi } from 'vitest';
import { shouldEnqueueGta, shouldProcessGta, seedDoneKeys } from './gtaGate';

/**
 * Non-régression : au montage, si les originaux s'hydratent AVANT `gtaPhotos`
 * (gtaPhotos encore vide), aucune photo déjà persistée dans `gta_photos` ne doit
 * repartir vers /api/gtaify. Le rempart est `gtaDoneRef`, seedé de façon synchrone
 * depuis le store persistant (seedDoneKeys). On rejoue ici la séquence réelle
 * enqueue → drain de App.tsx en utilisant les gardes PURES, avec fetch mocké.
 */

// Mini-driver fidèle à App.tsx : enqueue (shouldEnqueueGta) puis drain
// (shouldProcessGta avant l'appel proxy). `fetchMock` tient lieu de postGtaify.
function runMountCycle(opts: {
  originals: Record<string, string>; // clés → original (hydratés en premier)
  persisted: Record<string, string>; // store gta_photos persistant
  gtaPhotos: Record<string, string>; // état au moment de l'enqueue (vide = race)
  seed: boolean;                     // CHANGEMENT 1 appliqué ou non
}) {
  const fetchMock = vi.fn((key: string) => `styled:${key}`);
  const done = new Set<string>(opts.seed ? seedDoneKeys(opts.persisted) : []);
  const inflight = new Set<string>();
  const queue: Array<{ key: string; original: string }> = [];

  // Phase enqueue (le useEffect d'auto-enqueue : pour chaque original sans GTA).
  for (const [key, original] of Object.entries(opts.originals)) {
    if (opts.gtaPhotos[key]) continue; // gate explicite de l'effect (!gtaPhotos[e.key])
    const ok = shouldEnqueueGta(key, original, false, {
      gtaPhotos: opts.gtaPhotos,
      done,
      inflight,
      isQueued: (k) => queue.some((j) => j.key === k),
    });
    if (ok) queue.push({ key, original });
  }

  // Phase drain (garde final avant l'appel facturé).
  for (const job of queue) {
    if (!shouldProcessGta(job.key, done)) continue;
    done.add(job.key);
    fetchMock(job.key);
  }

  return fetchMock;
}

/**
 * Simulation TEMPORELLE du montage : les 5 lectures IndexedDB résolvent dans un
 * ordre donné ('originals' = course/captured/spot/free ; 'gta' = loadGtaPhotos
 * qui seede gtaDoneRef + lève gtaHydrated). Après CHAQUE résolution, l'effet
 * d'auto-enqueue tourne — mais ne fait rien tant que `gtaHydrated` est faux si
 * `respectHydrationGate` est actif (le fix). `fetchMock` = appel proxy.
 */
function simulateMount(opts: {
  originals: Record<string, string>;
  persisted: Record<string, string>;
  order: Array<'originals' | 'gta'>;
  respectHydrationGate: boolean; // false = comportement AVANT le fix de la race
}) {
  const fetchMock = vi.fn((key: string) => `styled:${key}`);
  const done = new Set<string>();
  const inflight = new Set<string>();
  const queue: Array<{ key: string; original: string }> = [];
  let originalsLoaded = false;
  let gtaPhotos: Record<string, string> = {};
  let gtaHydrated = false;

  const runAutoEnqueueEffect = () => {
    if (opts.respectHydrationGate && !gtaHydrated) return; // le fix : attend le seed
    if (!originalsLoaded) return; // rien à parcourir tant que les originaux manquent
    for (const [key, original] of Object.entries(opts.originals)) {
      if (gtaPhotos[key]) continue; // gate de l'effect : !gtaPhotos[e.key]
      const ok = shouldEnqueueGta(key, original, false, {
        gtaPhotos, done, inflight, isQueued: (k) => queue.some((j) => j.key === k),
      });
      if (ok) queue.push({ key, original });
    }
    // drain (synchrone ici) avec le garde final avant l'appel facturé
    while (queue.length) {
      const job = queue.shift()!;
      if (!shouldProcessGta(job.key, done)) continue;
      done.add(job.key);
      fetchMock(job.key);
    }
  };

  for (const event of opts.order) {
    if (event === 'originals') originalsLoaded = true;
    if (event === 'gta') {
      seedDoneKeys(opts.persisted).forEach((k) => done.add(k)); // seed synchrone
      gtaPhotos = { ...opts.persisted };
      gtaHydrated = true;
    }
    runAutoEnqueueEffect(); // l'effet re-tourne à chaque résolution (deps changent)
  }

  return fetchMock;
}

describe('gtaGate — indépendance à l\'ordre d\'hydratation (la vraie race)', () => {
  const originals = { 'course:a': 'origA', 'loc:1': 'orig1' };
  const persisted = { 'course:a': 'gtaA', 'loc:1': 'gta1' };

  it('originaux résolus AVANT gta + gate active → 0 appel proxy', () => {
    const fetchMock = simulateMount({ originals, persisted, order: ['originals', 'gta'], respectHydrationGate: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gta résolu AVANT originaux + gate active → 0 appel proxy', () => {
    const fetchMock = simulateMount({ originals, persisted, order: ['gta', 'originals'], respectHydrationGate: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('régression réelle : originaux d\'abord SANS gate d\'hydratation → re-gtaification (bug)', () => {
    const fetchMock = simulateMount({ originals, persisted, order: ['originals', 'gta'], respectHydrationGate: false });
    expect(fetchMock).toHaveBeenCalledTimes(2); // exactement ce que voyait le chef
  });

  it('gate active : une nouvelle photo non persistée part bien au proxy après hydratation', () => {
    const fetchMock = simulateMount({
      originals: { 'course:a': 'origA', 'loc:9': 'orig9' },
      persisted: { 'course:a': 'gtaA' },
      order: ['originals', 'gta'],
      respectHydrationGate: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('loc:9');
  });
});

describe('gtaGate — pas de re-gtaification au montage', () => {
  it('seed actif : 0 appel proxy pour les clés déjà persistées (originaux hydratés en premier)', () => {
    const originals = { 'course:a': 'origA', 'loc:1': 'orig1' };
    const persisted = { 'course:a': 'gtaA', 'loc:1': 'gta1' };
    const fetchMock = runMountCycle({ originals, persisted, gtaPhotos: {}, seed: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('régression historique : sans seed, la race ré-enfile tout vers le proxy', () => {
    const originals = { 'course:a': 'origA', 'loc:1': 'orig1' };
    const persisted = { 'course:a': 'gtaA', 'loc:1': 'gta1' };
    const fetchMock = runMountCycle({ originals, persisted, gtaPhotos: {}, seed: false });
    expect(fetchMock).toHaveBeenCalledTimes(2); // le bug que le fix corrige
  });

  it('seed actif : une NOUVELLE photo sans version GTA part bien au proxy (1 appel)', () => {
    const originals = { 'course:a': 'origA', 'loc:9': 'orig9' };
    const persisted = { 'course:a': 'gtaA' }; // loc:9 jamais stylisée
    const fetchMock = runMountCycle({ originals, persisted, gtaPhotos: {}, seed: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('loc:9');
  });
});

describe('gtaGate — gardes unitaires', () => {
  const base = { gtaPhotos: {} as Record<string, string>, done: new Set<string>(), inflight: new Set<string>(), isQueued: () => false };

  it('refuse une clé déjà dans done', () => {
    expect(shouldEnqueueGta('k', 'o', false, { ...base, done: new Set(['k']) })).toBe(false);
  });

  it('refuse une clé déjà en gtaPhotos', () => {
    expect(shouldEnqueueGta('k', 'o', false, { ...base, gtaPhotos: { k: 'v' } })).toBe(false);
  });

  it('force=true court-circuite done/gtaPhotos (régénération manuelle)', () => {
    expect(shouldEnqueueGta('k', 'o', true, { ...base, done: new Set(['k']), gtaPhotos: { k: 'v' } })).toBe(true);
  });

  it('refuse une clé en vol ou déjà en file, et un original vide', () => {
    expect(shouldEnqueueGta('k', 'o', false, { ...base, inflight: new Set(['k']) })).toBe(false);
    expect(shouldEnqueueGta('k', 'o', false, { ...base, isQueued: () => true })).toBe(false);
    expect(shouldEnqueueGta('k', '', false, base)).toBe(false);
  });

  it('shouldProcessGta : bloque le déjà-fait, laisse passer le reste', () => {
    expect(shouldProcessGta('k', new Set(['k']))).toBe(false);
    expect(shouldProcessGta('k', new Set())).toBe(true);
  });
});
