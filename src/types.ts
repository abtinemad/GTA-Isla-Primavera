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
  | 'Beach Club'
  | '🏆 Trophées - Time Attack'
  | '🏆 Trophées - Maître des Éléments'
  | '🏆 Trophées - Explorateur de l\'Insolite'
  | '🏆 Trophées - Grand Tourer'
  | '🏆 Trophées - Life-Style';

/**
 * A photo spot's flavour, used to pick its map marker variant.
 * (Courses/races are a separate dataset — see src/data/coursesData.ts.)
 */
export type MissionType = 'photo-principale' | 'photo-annexe';

export interface LocationItem {
  id: number;
  name: string;
  category: Category;
  lat: number;
  lng: number;
  info: string;
  custom?: boolean; // True if added by the user in-session
  /** Photo-mission flavour (principale / annexe). Drives the marker variant. */
  missionType?: MissionType;
}

export interface FilterOption {
  label: string;
  categoryValue: Category | 'Tous';
  icon: string;
}
