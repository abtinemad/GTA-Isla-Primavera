/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Category } from './types';
import { CATEGORY_MAP, categoryIconSvg } from './utils/helper';

/**
 * SOURCE DE VÉRITÉ UNIQUE des filtres carte/liste — DÉRIVÉE de `CATEGORY_MAP`
 * (la même config que les pins), pas d'une liste codée en dur. Une entrée par
 * catégorie de données réellement affichée (trophées 🏆 exclus) → le bandeau ne
 * peut plus diverger des pins. Partagée par MapFilterBar, QuickFilterBar et la
 * logique de visibilité (LocationsList, App).
 *
 * - `id` / `label` = la catégorie telle quelle dans les données (CATEGORY_MAP.label).
 * - `color` = CATEGORY_MAP.accentColor (palette des marqueurs).
 * - `iconSvg` = EXACTEMENT le glyphe du pin de la catégorie (markerGlyphSvg ∘
 *   categoryToVariant). Aucune liste d'icônes parallèle : une seule source, donc le
 *   bandeau ne peut plus diverger des pins.
 */

// Catégories filtrables, dans l'ordre d'affichage du bandeau (hors trophées).
const FILTER_CATEGORIES = [
  'QG',
  'Plages',
  'Restaurants',
  'Beach Club',
  'Bars',
  'Ravitaillement',
  'Escapades',
  'Missions',
] as const satisfies readonly Category[];

export type FilterGroup = (typeof FILTER_CATEGORIES)[number];

export interface FilterGroupDef {
  id: FilterGroup;
  label: string;
  color: string; // chip accent (= palette marqueur)
  iconSvg: string; // glyphe du pin (currentColor), rendu via dangerouslySetInnerHTML
  categories: Category[]; // catégorie(s) data contrôlée(s) par ce chip
}

export const FILTER_GROUPS: FilterGroupDef[] = FILTER_CATEGORIES.map((cat) => ({
  id: cat,
  label: CATEGORY_MAP[cat].label,
  color: CATEGORY_MAP[cat].accentColor,
  iconSvg: categoryIconSvg(cat),
  categories: [cat],
}));

export const ALL_GROUP_IDS: FilterGroup[] = FILTER_GROUPS.map((g) => g.id);

/** Group that owns a given data category (null for trophy entries). */
export function groupForCategory(category: Category): FilterGroup | null {
  const def = FILTER_GROUPS.find((g) => g.categories.includes(category));
  return def ? def.id : null;
}

/** True when a spot's category belongs to one of the active (visible) groups. */
export function isCategoryVisible(category: Category, activeGroups: FilterGroup[]): boolean {
  const g = groupForCategory(category);
  return g !== null && activeGroups.includes(g);
}
