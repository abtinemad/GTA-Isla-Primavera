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

export interface LocationItem {
  id: number;
  name: string;
  category: Category;
  lat: number;
  lng: number;
  info: string;
  custom?: boolean; // True if added by the user in-session
}

export interface FilterOption {
  label: string;
  categoryValue: Category | 'Tous';
  icon: string;
}
