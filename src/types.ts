/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Category = 
  | 'QG' 
  | 'Ravitaillement' 
  | 'Bars' 
  | 'Missions' 
  | 'Escapades' 
  | 'Plages' 
  | 'Restaurants'
  | '🏆 Trophées - Time Attack'
  | '🏆 Trophées - Maître des Éléments'
  | '🏆 Trophées - Explorateur de l\'Insolite'
  | '🏆 Trophées - Grand Tourer'
  | '🏆 Trophées - Life-Style';

/** A mission's flavour, used to pick its map marker variant. */
export type MissionType = 'photo-principale' | 'photo-annexe' | 'course';

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Race ("course") payload carried by a mission of type 'course'.
 * `start` is the clickable depart pin (= the location's own lat/lng), `end`
 * the finish pin. `route` is the drawn track; when absent/short, the renderer
 * falls back to a straight start→end line. `distanceKm` is derived from the
 * route (haversine) when not provided. `chronoIndicatifSec` is the par time.
 */
export interface CourseData {
  start: LatLng;
  end: LatLng;
  route?: LatLng[];
  distanceKm?: number;
  chronoIndicatifSec: number;
}

export interface LocationItem {
  id: number;
  name: string;
  category: Category;
  lat: number;
  lng: number;
  info: string;
  custom?: boolean; // True if added by the user in-session
  /** Mission flavour (photo / course). Drives the marker variant. */
  missionType?: MissionType;
  /** Present when missionType === 'course'. */
  course?: CourseData;
}

export interface FilterOption {
  label: string;
  categoryValue: Category | 'Tous';
  icon: string;
}
