/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Category } from '../types';

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
 * Generates a custom flat gaming "blip" marker (Spec §4): solid category
 * background, hard black border, distinct shape, no inner white ring.
 */
export function getMarkerHtml(category: Category, isActive: boolean, label: string, isCompleted?: boolean): string {
  // Normalize category to one of the seven primary blip families
  let cleanCategory = 'Escapades';
  if (category.includes('QG')) cleanCategory = 'QG';
  else if (category.includes('Ravitaillement')) cleanCategory = 'Ravitaillement';
  else if (category.includes('Bars')) cleanCategory = 'Bars';
  else if (category.includes('Missions')) cleanCategory = 'Missions';
  else if (category.includes('Escapades')) cleanCategory = 'Escapades';
  else if (category.includes('Plages')) cleanCategory = 'Plages';
  else if (category.includes('Restaurants')) cleanCategory = 'Restaurants';

  const blip = BLIP_STYLE[cleanCategory];
  const radius = blip.shape === 'disk' ? '9999px' : blip.shape === 'rounded' ? '11px' : '7px';
  const badgeRotation = blip.shape === 'diamond' ? 'rotate(45deg)' : 'none';
  const emojiRotation = blip.shape === 'diamond' ? 'rotate(-45deg)' : 'none';

  // Active state lifts the blip, swaps the border to white and adds a cyan pulse ring
  const activeBorder = isActive ? '#FFFFFF' : '#000000';
  const activeScale = isActive ? 'scale(1.18)' : 'scale(1)';

  return `
    <div class="flex items-center justify-center relative select-none" style="background:none!important;border:none!important;padding:0!important;outline:none!important;box-shadow:none!important;cursor:pointer;pointer-events:auto!important;width:44px;height:44px;">

      ${isActive ? `
        <div class="absolute rounded-full bg-cyan-400/20 animate-ping" style="width:44px;height:44px;left:50%;top:50%;transform:translate(-50%,-50%);z-index:-1;pointer-events:none!important;"></div>
        <div class="absolute rounded-full border border-cyan-400/60" style="width:50px;height:50px;left:50%;top:50%;transform:translate(-50%,-50%);z-index:-1;pointer-events:none!important;box-shadow:0 0 14px rgba(34,211,238,0.55);"></div>
      ` : ''}

      <!-- Flat category blip body -->
      <div class="flex items-center justify-center transition-all duration-300" 
           style="width:38px;height:38px;background-color:${blip.color};border:2px solid ${activeBorder};border-radius:${radius};transform:${badgeRotation} ${activeScale};box-shadow:0 3px 8px rgba(0,0,0,0.55);pointer-events:auto!important;">
        <span class="select-none leading-none" style="font-size:18px;line-height:1;transform:${emojiRotation};pointer-events:none!important;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.6));">${blip.emoji}</span>
      </div>

      <!-- Completion checkmark -->
      ${isCompleted ? `
        <div class="absolute bg-emerald-500 text-white rounded-full border border-black w-4 h-4 flex items-center justify-center font-sans font-black text-[9px] shadow-md z-50" 
             style="top:-2px;right:-2px;pointer-events:none!important;">✓</div>
      ` : ''}

    </div>
  `;
}
