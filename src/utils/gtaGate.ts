/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Garde-fous PURS de la file de stylisation GTA (pas de React, pas d'IO) —
 * extraits pour être testables et partagés par `enqueueGta` ET `drainGtaQueue`
 * dans `App.tsx`. Le but : ne JAMAIS rappeler le proxy `/api/gtaify` (crédits
 * Gemini) pour une photo déjà gtaifiée, quel que soit l'ordre d'hydratation des
 * stores IndexedDB au montage.
 */

export type EnqueueGateState = {
  /** Versions GTA en état (hydratées depuis le store `gta_photos`). */
  gtaPhotos: Record<string, string>;
  /** Clés stylisées avec succès, marquées de façon SYNCHRONE (seedée au montage
   *  depuis le store persistant — c'est ce seed qui ferme la race d'hydratation). */
  done: Set<string>;
  /** Clés en cours d'envoi au proxy. */
  inflight: Set<string>;
  /** La clé est-elle déjà dans la file d'attente ? */
  isQueued: (key: string) => boolean;
};

/**
 * Décide si une clé mérite d'être ENFILÉE (donc un appel proxy à venir).
 * `force` (régénération manuelle) court-circuite UNIQUEMENT le garde « déjà
 * stylisée » — l'appelant doit alors avoir retiré la clé de `done` au préalable.
 */
export function shouldEnqueueGta(
  key: string,
  original: string,
  force: boolean,
  state: EnqueueGateState,
): boolean {
  if (!original) return false;
  // déjà stylisée — état gtaPhotos OU marqueur synchrone done (seedé au montage).
  if (!force && (state.gtaPhotos[key] || state.done.has(key))) return false;
  if (state.inflight.has(key)) return false; // déjà en vol
  if (state.isQueued(key)) return false;     // déjà en file
  return true;
}

/**
 * Dernière barrière AVANT l'appel facturé : un job déjà marqué `done` ne doit
 * jamais partir au proxy (défense en profondeur si un job atteint la file par un
 * autre chemin). La régénération manuelle retire la clé de `done` en amont.
 */
export function shouldProcessGta(key: string, done: Set<string>): boolean {
  return !done.has(key);
}

/**
 * Clés à amorcer dans `done` à partir du Record persistant (`loadGtaPhotos`).
 * Appelé de façon SYNCHRONE à la résolution, avant tout auto-enqueue.
 */
export function seedDoneKeys(persisted: Record<string, string>): string[] {
  return Object.keys(persisted);
}
