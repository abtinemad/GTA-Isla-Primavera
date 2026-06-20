/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Category, LocationItem } from './types';
import { INITIAL_LOCATIONS } from './locationsData';

/**
 * Cover Quest — "jaquette GRAND TENERIFE AUTO · EP".
 *
 * The completable spots are DERIVED, not invented: a location is completable
 * iff its category has a real validation mechanism in the app. Today that is
 * Missions (geofenced chrono run), Escapades and Plages (geofenced photo).
 * QG / Ravitaillement / Bars / Restaurants have no completion path, so they
 * are intentionally excluded. This yields exactly 11 cover slots.
 */
export const COMPLETABLE_CATEGORIES: Category[] = ['Missions', 'Escapades', 'Plages'];

/**
 * Short editorial labels for the cover montage (validated with the product owner).
 * Keyed by the existing location id — no fictional places, just a short name per spot.
 */
export const COVER_LABELS: Record<number, string> = {
  7: 'TEIDE',       // Parador de Las Cañadas del Teide (Mission Volcan TF-21)
  8: 'MASCA',       // Point de vue de Cherfe (Mission Teno TF-436)
  9: 'ANAGA',       // Plaza del Cristo / La Laguna (Mission Anaga TF-12)
  12: 'RADAZUL',    // Puerto Deportivo Radazul (Mission Côte Est)
  13: 'EL MÉDANO',  // Plaza de El Médano (Mission Côte Est)
  10: 'ABADES',     // Abades, village fantôme (Escapade Côte Est)
  11: 'HUMBOLDT',   // Mirador de Humboldt / El Sauzal (Escapade Nord)
  17: 'DIEGO H.',   // Playa de Diego Hernández (Plage)
  18: 'TERESITAS',  // Playa de Las Teresitas (Plage)
  19: 'DUQUE',      // Playa del Duque (Plage)
  20: 'ENRAMADA',   // Playa de la Enramada (Plage)
};

export type CoverSlotStatus = 'locked' | 'unlockable' | 'filled';

export type CoverSlot = {
  id: number;
  position: number;
  status: CoverSlotStatus;
  photoUrl?: string;
  category: Category;
  label: string;
  location: LocationItem;
};

// The 11 completable locations, in data order, as the immutable slot backbone.
export const COVER_LOCATIONS: LocationItem[] = INITIAL_LOCATIONS.filter((l) =>
  COMPLETABLE_CATEGORIES.includes(l.category),
);

export const shortLabel = (loc: LocationItem): string =>
  COVER_LABELS[loc.id] || loc.name.toUpperCase().slice(0, 10);
