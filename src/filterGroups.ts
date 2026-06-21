/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Category } from './types';

/**
 * Map/list filters are grouped into six editorial families (chips / legend),
 * not the seven raw data categories. This is the SINGLE source of truth shared
 * by the map overlay (MapFilterBar), the spot-view bar (QuickFilterBar) and the
 * spot list (LocationsList) — so toggling a chip anywhere shows/hides the same
 * markers and cards.
 *
 * Multi-select: each group is independently visible/hidden. Colours are aligned
 * with the map marker palette (see `MARKER_VARIANTS` in utils/helper.ts).
 */
export type FilterGroup =
  | 'QG'
  | 'Restaurants'
  | 'Ville' // coctelería + cannabis (Bars + Ravitaillement)
  | 'Plages'
  | 'Photos' // missions photo (Escapades)
  | 'Courses'; // missions chronométrées (Missions)

export interface FilterGroupDef {
  id: FilterGroup;
  label: string;
  emoji: string;
  color: string; // chip accent (aligned with the map marker palette)
  categories: Category[]; // raw data categories this chip controls
}

export const FILTER_GROUPS: FilterGroupDef[] = [
  { id: 'QG', label: 'QG', emoji: '🏠', color: '#EAC54F', categories: ['QG'] },
  { id: 'Restaurants', label: 'Restaurants', emoji: '🍴', color: '#F0941E', categories: ['Restaurants'] },
  { id: 'Ville', label: 'Ville', emoji: '🍸', color: '#00E0CB', categories: ['Bars', 'Ravitaillement'] },
  { id: 'Plages', label: 'Plages', emoji: '🏖️', color: '#FFD60A', categories: ['Plages'] },
  { id: 'Photos', label: 'Photos', emoji: '📸', color: '#FF2E9A', categories: ['Escapades'] },
  { id: 'Courses', label: 'Courses', emoji: '🏁', color: '#EA4423', categories: ['Missions'] },
];

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
