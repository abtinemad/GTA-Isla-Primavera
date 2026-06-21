/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Category } from '../types';

/**
 * Great-circle distance in kilometres between two lat/lng points.
 * Shared by the geofence checks (50 m proximity gate) across the app.
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 50-metre geofence radius (in km) — the validated-on-site proximity rule.
export const GEOFENCE_KM = 0.05;

export interface CategoryInfo {
  label: string;
  emoji: string;
  colorClass: string;   // Tailwind color representation for badges
  bgClass: string;      // Background Tailwind class
  borderClass: string;  // Border Tailwind class
  textClass: string;    // Text Tailwind class
  accentColor: string;  // HEX representation for styling raw things like map interactions
  iconName: string;
  desc: string;
}

export const CATEGORY_MAP: Record<Category, CategoryInfo> = {
  QG: {
    label: 'QG',
    emoji: '🏢',
    colorClass: 'neutral',
    // QG token (--cat-qg #EDEFF2) is near-white — readable neutral chip on light surfaces.
    bgClass: 'bg-[#EDEFF2] text-[#5B5D66] border-zinc-300',
    borderClass: 'border-[#EDEFF2]',
    textClass: 'text-[#5B5D66]',
    accentColor: '#EDEFF2', // Token --cat-qg (neutral, for dark surfaces)
    iconName: 'Home',
    desc: 'Safehouse Principal, point de spawn, sauvegarde et planification'
  },
  Ravitaillement: {
    label: 'Ravitaillement',
    emoji: '🌿',
    colorClass: 'green',
    bgClass: 'bg-[#46AE3C]/15 text-[#46AE3C] border-[#46AE3C]/30',
    borderClass: 'border-[#46AE3C]',
    textClass: 'text-[#46AE3C]',
    accentColor: '#46AE3C', // Token --cat-ravito
    iconName: 'Leaf',
    desc: 'Dispensaire, recharge de matériel et drop-off'
  },
  Bars: {
    label: 'Bars',
    emoji: '🍸',
    colorClass: 'pink',
    bgClass: 'bg-[#E0479B]/15 text-[#E0479B] border-[#E0479B]/30',
    borderClass: 'border-[#E0479B]',
    textClass: 'text-[#E0479B]',
    accentColor: '#E0479B', // Token --cat-bars
    iconName: 'GlassWater',
    desc: 'Cocktails premium, terrasse et mixologie avancée'
  },
  Missions: {
    label: 'Missions',
    emoji: '🌋',
    colorClass: 'red',
    bgClass: 'bg-[#EA4423]/15 text-[#EA4423] border-[#EA4423]/30',
    borderClass: 'border-[#EA4423]',
    textClass: 'text-[#EA4423]',
    accentColor: '#EA4423', // Token --cat-missions / --isla-primary
    iconName: 'Flag',
    desc: 'Épreuves tactiques, tracés chronométrés et défis de conduite'
  },
  Escapades: {
    label: 'Escapades',
    emoji: '🧭', // Clean Exploration Compass
    colorClass: 'purple',
    bgClass: 'bg-[#9E7AD2]/15 text-[#9E7AD2] border-[#9E7AD2]/30',
    borderClass: 'border-[#9E7AD2]',
    textClass: 'text-[#9E7AD2]',
    accentColor: '#9E7AD2', // Token --cat-escapades
    iconName: 'Compass',
    desc: 'Exploration de lieux insolites, insolites ou abandonnés'
  },
  Plages: {
    label: 'Plages',
    emoji: '🏖️',
    colorClass: 'blue',
    bgClass: 'bg-[#3F6CC4]/15 text-[#3F6CC4] border-[#3F6CC4]/30',
    borderClass: 'border-[#3F6CC4]',
    textClass: 'text-[#3F6CC4]',
    accentColor: '#3F6CC4', // Token --cat-plages
    iconName: 'Trees',
    desc: 'Détente côtière, criques sauvages et plages du Sahara'
  },
  Restaurants: {
    label: 'Restaurants',
    emoji: '🍽️',
    colorClass: 'orange',
    bgClass: 'bg-[#F0941E]/15 text-[#C2710E] border-[#F0941E]/30',
    borderClass: 'border-[#F0941E]',
    textClass: 'text-[#C2710E]',
    accentColor: '#F0941E', // Token --cat-restaurants
    iconName: 'Utensils',
    desc: 'Arrêt au stand pour restauration ou réapprovisionnement énergétique'
  },
  '🏆 Trophées - Time Attack': {
    label: 'Trophées - Time Attack',
    emoji: '🏆',
    colorClass: 'yellow',
    bgClass: 'bg-[#E1C233]/10 text-[#E1C233] border-[#E1C233]/20',
    borderClass: 'border-[#E1C233]',
    textClass: 'text-[#E1C233]',
    accentColor: '#E1C233',
    iconName: 'Trophy',
    desc: 'Défis et chronos de conduite sur parcours dynamique'
  },
  '🏆 Trophées - Maître des Éléments': {
    label: 'Trophées - Maître des Éléments',
    emoji: '🏆',
    colorClass: 'yellow',
    bgClass: 'bg-[#E1C233]/10 text-[#E1C233] border-[#E1C233]/20',
    borderClass: 'border-[#E1C233]',
    textClass: 'text-[#E1C233]',
    accentColor: '#E1C233',
    iconName: 'Trophy',
    desc: 'Maîtrise des conditions de route et climatiques aux sommets'
  },
  '🏆 Trophées - Explorateur de l\'Insolite': {
    label: 'Trophées - Explorateur de l\'Insolite',
    emoji: '🏆',
    colorClass: 'yellow',
    bgClass: 'bg-[#E1C233]/10 text-[#E1C233] border-[#E1C233]/20',
    borderClass: 'border-[#E1C233]',
    textClass: 'text-[#E1C233]',
    accentColor: '#E1C233',
    iconName: 'Trophy',
    desc: 'Localisation de secrets cachés et lieux abandonnés'
  },
  '🏆 Trophées - Grand Tourer': {
    label: 'Trophées - Grand Tourer',
    emoji: '🏆',
    colorClass: 'yellow',
    bgClass: 'bg-[#E1C233]/10 text-[#E1C233] border-[#E1C233]/20',
    borderClass: 'border-[#E1C233]',
    textClass: 'text-[#E1C233]',
    accentColor: '#E1C233',
    iconName: 'Trophy',
    desc: 'Runs d\'endurance et liaisons côtières'
  },
  '🏆 Trophées - Life-Style': {
    label: 'Trophées - Life-Style',
    emoji: '🏆',
    colorClass: 'yellow',
    bgClass: 'bg-[#E1C233]/10 text-[#E1C233] border-[#E1C233]/20',
    borderClass: 'border-[#E1C233]',
    textClass: 'text-[#E1C233]',
    accentColor: '#E1C233',
    iconName: 'Trophy',
    desc: 'Activités annexes et combos de spots'
  }
};

/**
 * Per-category "Custom Gaming Blip" charter (Spec §4):
 * flat, ultra-contrasted badge — solid category color, hard black border,
 * no inner white ring, distinct shape per category.
 */
const BLIP_STYLE: Record<string, { color: string; emoji: string; shape: 'disk' | 'rounded' | 'diamond' }> = {
  QG:             { color: '#EDEFF2', emoji: '🏢', shape: 'rounded' },  // Token --cat-qg (neutral)
  Ravitaillement: { color: '#46AE3C', emoji: '🌿', shape: 'rounded' },  // Token --cat-ravito
  Bars:           { color: '#E0479B', emoji: '🍸', shape: 'disk' },     // Token --cat-bars
  Missions:       { color: '#EA4423', emoji: '🌋', shape: 'diamond' },  // Token --cat-missions
  Escapades:      { color: '#9E7AD2', emoji: '🧭', shape: 'disk' },     // Token --cat-escapades
  Plages:         { color: '#3F6CC4', emoji: '🏖️', shape: 'rounded' },  // Token --cat-plages
  Restaurants:    { color: '#F0941E', emoji: '🍽️', shape: 'disk' },     // Token --cat-restaurants
};

/**
 * Vice / Manrique category marker (divIcon HTML).
 *  - Mission   → red diamond, white rim, white centre dot.
 *  - QG        → white teardrop pin with a black "H".
 *  - others    → rounded tile in the category colour + white rim + emoji glyph.
 * Active = cyan rim + cyan ping ring. Completed = green check badge.
 */
export function getMarkerHtml(category: Category, isActive: boolean, label: string, isCompleted?: boolean): string {
  // Normalize category to one of the seven primary families
  let cleanCategory = 'Escapades';
  if (category.includes('QG')) cleanCategory = 'QG';
  else if (category.includes('Ravitaillement')) cleanCategory = 'Ravitaillement';
  else if (category.includes('Bars')) cleanCategory = 'Bars';
  else if (category.includes('Missions')) cleanCategory = 'Missions';
  else if (category.includes('Escapades')) cleanCategory = 'Escapades';
  else if (category.includes('Plages')) cleanCategory = 'Plages';
  else if (category.includes('Restaurants')) cleanCategory = 'Restaurants';

  const blip = BLIP_STYLE[cleanCategory];
  const rim = isActive ? '#00F5D4' : '#FFFFFF';
  const scale = isActive ? 'scale(1.16)' : 'scale(1)';

  let body: string;
  if (cleanCategory === 'Missions') {
    // Red diamond + volcano glyph (counter-rotated so it stays upright)
    body = `<div style="width:26px;height:26px;background:${blip.color};border:2px solid ${rim};border-radius:6px;transform:rotate(45deg) ${scale};box-shadow:0 2px 6px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;pointer-events:auto;">
      <span style="font-size:14px;line-height:1;transform:rotate(-45deg);filter:drop-shadow(0 1px 1px rgba(0,0,0,.55));">${blip.emoji}</span>
    </div>`;
  } else if (cleanCategory === 'QG') {
    // White teardrop pin + black H
    body = `<div style="width:26px;height:26px;background:#EDEFF2;border:2px solid ${isActive ? rim : '#0a0a0b'};border-radius:50% 50% 50% 0;transform:rotate(-45deg) ${scale};box-shadow:0 2px 6px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;pointer-events:auto;">
      <span style="transform:rotate(45deg);font:800 13px 'Space Grotesk',sans-serif;color:#0a0a0b;">H</span>
    </div>`;
  } else {
    // Rounded tile + emoji glyph
    body = `<div style="width:26px;height:26px;background:${blip.color};border:1.8px solid ${rim};border-radius:9px;transform:${scale};box-shadow:0 2px 6px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;pointer-events:auto;">
      <span style="font-size:15px;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.55));">${blip.emoji}</span>
    </div>`;
  }

  return `
    <div class="relative flex items-center justify-center select-none" style="width:34px;height:34px;background:none!important;border:none!important;pointer-events:auto!important;">
      ${isActive ? `<div class="absolute rounded-full animate-ping" style="width:34px;height:34px;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(0,245,212,.25);z-index:-1;pointer-events:none!important;"></div>` : ''}
      ${body}
      ${isCompleted ? `<div style="position:absolute;top:-3px;right:-3px;width:15px;height:15px;border-radius:50%;background:#46AE3C;border:1.5px solid #0a0a0b;color:#fff;font:800 9px sans-serif;display:flex;align-items:center;justify-content:center;z-index:5;pointer-events:none;">✓</div>` : ''}
    </div>
  `;
}
