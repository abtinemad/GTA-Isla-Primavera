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

// Geofence radii aligned with the canonical model (CLAUDE.md):
//  • Escapades/Plages validate by PHOTO at < 500 m (paysages cadrés de loin).
//  • Missions validate by the 50 m chrono finish line in App.tsx — the camera
//    does NOT complete them, so a mission tile is never camera-unlockable here.
//    100 m is only an "approach" radius used for the proximity notification.
export const PHOTO_UNLOCK_KM = 0.5;
export const MISSION_APPROACH_KM = 0.1;

/** A cover slot whose validation front-end is the Cover Quest camera (photo). */
export const isPhotoSlot = (category: Category): boolean =>
  category === 'Escapades' || category === 'Plages';

/** Radius at which we surface a "you're approaching the zone" notification. */
export const approachRadiusKm = (category: Category): number =>
  isPhotoSlot(category) ? PHOTO_UNLOCK_KM : MISSION_APPROACH_KM;

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
