/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Category, LocationItem } from '../types';

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
  'Beach Club': {
    label: 'Beach Club',
    emoji: '🍹',
    colorClass: 'coral',
    bgClass: 'bg-[#FF6F61]/15 text-[#D14B3C] border-[#FF6F61]/30',
    borderClass: 'border-[#FF6F61]',
    textClass: 'text-[#D14B3C]',
    accentColor: '#FF6F61', // Token --cat-beachclub (corail, inédit)
    iconName: 'Umbrella',
    desc: 'Beach clubs premium : transats, DJ et cocktails face à l\'océan'
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
 * Unified marker system — "goutte à l'envers" (teardrop pin) for EVERY marker.
 *
 * One shape (SVG teardrop, modelled on the old QG pin), differentiated only by
 * a glyph + a colour. No more square tiles or rotated diamonds. Each variant is
 * a reusable entry consumed by `buildMarkerHtml` (the factory) below.
 *
 * Glyphs are tiny inline SVGs authored in a 20×20 box (centre 10,10), so they
 * drop cleanly into the pin head. `g` = glyph colour, `fill` = pin colour
 * (used by the filled camera to "cut out" its lens).
 */
export type MarkerVariant =
  | 'qg'
  | 'restaurant'
  | 'cocktail'
  | 'cannabis'
  | 'plage'
  | 'beach-club'             // beach club : parasol + cocktail tropical, corail
  | 'mission-photo-principale' // mission photo principale (appareil photo plein)
  | 'mission-photo-annexe'     // mission photo annexe (contour, atténué, plus petit)
  | 'course-depart'         // course : ligne de départ (fanion)
  | 'course-arrivee';       // course : ligne d'arrivée (drapeau à damier)

interface MarkerVariantStyle {
  fill: string;       // pin body colour
  glyphColor: string; // glyph colour (chosen for contrast on `fill`)
  scale: number;      // base size multiplier (annexe pins are smaller)
  glyph: (g: string, fill: string) => string; // inner SVG of the glyph
}

const MARKER_VARIANTS: Record<MarkerVariant, MarkerVariantStyle> = {
  // QG — doré / blanc, glyphe "H"
  qg: {
    fill: '#EAC54F', glyphColor: '#FFFFFF', scale: 1,
    glyph: (g) => `<path d="M6 4V16M14 4V16M6 10H14" fill="none" stroke="${g}" stroke-width="2.6" stroke-linecap="round"/>`,
  },
  // Restaurant (complexe) — ambre, fourchette + couteau
  restaurant: {
    fill: '#F0941E', glyphColor: '#2A1400', scale: 1,
    glyph: (g) => `<path d="M6 4v4.5a1.4 1.4 0 0 0 2.8 0V4M7.4 8.5V17M14 4c-1.6 1.4-1.6 5.6 0 7v6" fill="none" stroke="${g}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  // Coctelería — cyan néon, verre à cocktail
  cocktail: {
    fill: '#00E0CB', glyphColor: '#053330', scale: 1,
    glyph: (g) => `<path d="M3.5 5h13l-6.5 7zM10 12v4M6.5 16h7" fill="none" stroke="${g}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  // Cannabis club — vert néon, VRAIE feuille de cannabis (lucide `Cannabis`,
  // icône 24×24 stroke mappée dans la box 20×20 centrée en 10,10 ; stroke = glyphColor,
  // épaissi pour rester lisible à la taille du pin). Couleurs inchangées.
  cannabis: {
    fill: '#2BE38A', glyphColor: '#053A22', scale: 1,
    glyph: (g) => `<g transform="translate(10 10) scale(0.8) translate(-12 -12)" fill="none" stroke="${g}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-4"/><path d="M7 12c-1.5 0-4.5 1.5-5 3 3.5 1.5 6 1 6 1-1.5 1.5-2 3.5-2 5 2.5 0 4.5-1.5 6-3 1.5 1.5 3.5 3 6 3 0-1.5-.5-3.5-2-5 0 0 2.5.5 6-1-.5-1.5-3.5-3-5-3 1.5-1 4-4 4-6-2.5 0-5.5 1.5-7 3 0-2.5-.5-5-2-7-1.5 2-2 4.5-2 7-1.5-1.5-4.5-3-7-3 0 2 2.5 5 4 6"/></g>`,
  },
  // Plage — JAUNE, parasol
  plage: {
    fill: '#FFD60A', glyphColor: '#3A2D00', scale: 1,
    glyph: (g) => `<path d="M3 10a7 7 0 0 1 14 0ZM10 4V2.5M10 10v7M10 17h2.6" fill="none" stroke="${g}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  // Beach club — CORAIL, cocktail tropical sous parasol
  'beach-club': {
    fill: '#FF6F61', glyphColor: '#3A0F08', scale: 1,
    glyph: (g) => `<path d="M9.5 4Q13 0.2 16.5 4Z" fill="${g}"/><path d="M13 4 11.4 9" fill="none" stroke="${g}" stroke-width="1.6" stroke-linecap="round"/><path d="M6.5 9H13.5L12 16H8Z" fill="none" stroke="${g}" stroke-width="1.7" stroke-linejoin="round"/>`,
  },
  // Mission photo principale — rose néon vif, appareil photo plein
  'mission-photo-principale': {
    fill: '#FF2E9A', glyphColor: '#FFFFFF', scale: 1,
    glyph: (g, fill) => `<path d="M3 7h2.6l1.3-1.9h6.2L14.4 7H17a1.3 1.3 0 0 1 1.3 1.3V15a1.3 1.3 0 0 1-1.3 1.3H3A1.3 1.3 0 0 1 1.7 15V8.3A1.3 1.3 0 0 1 3 7Z" fill="${g}"/><circle cx="10" cy="11.7" r="3.1" fill="${fill}"/><circle cx="10" cy="11.7" r="1.4" fill="${g}"/>`,
  },
  // Mission photo annexe — rose atténué, appareil photo en contour, pin plus petit
  'mission-photo-annexe': {
    fill: '#B65C8A', glyphColor: '#FFE6F2', scale: 0.82,
    glyph: (g) => `<path d="M3 7h2.6l1.3-1.9h6.2L14.4 7H17a1.3 1.3 0 0 1 1.3 1.3V15a1.3 1.3 0 0 1-1.3 1.3H3A1.3 1.3 0 0 1 1.7 15V8.3A1.3 1.3 0 0 1 3 7Z" fill="none" stroke="${g}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="10" cy="11.7" r="2.8" fill="none" stroke="${g}" stroke-width="1.6"/>`,
  },
  // Course — ligne de départ, ROUGE, fanion
  'course-depart': {
    fill: '#EA4423', glyphColor: '#FFFFFF', scale: 1,
    glyph: (g) => `<path d="M5 3v14" fill="none" stroke="${g}" stroke-width="2" stroke-linecap="round"/><path d="M5 3.5h10l-3.4 3 3.4 3H5z" fill="${g}"/>`,
  },
  // Course — ligne d'arrivée, ROUGE, drapeau à damier
  'course-arrivee': {
    fill: '#EA4423', glyphColor: '#FFFFFF', scale: 1,
    glyph: (g) => `<path d="M5 3v14" fill="none" stroke="${g}" stroke-width="2" stroke-linecap="round"/><rect x="5" y="3.5" width="11" height="7" fill="none" stroke="${g}" stroke-width="1.1"/><rect x="5" y="3.5" width="3.67" height="3.5" fill="${g}"/><rect x="12.33" y="3.5" width="3.67" height="3.5" fill="${g}"/><rect x="8.67" y="7" width="3.67" height="3.5" fill="${g}"/>`,
  },
};

/**
 * Default mapping of a data `Category` onto a marker variant. The data only
 * carries seven families, so the finer pairs (photo annexe, course départ) are
 * not auto-assigned here — pass an explicit variant to `buildMarkerHtml` when a
 * given spot needs one. Trophy categories are filtered out before rendering.
 */
export function categoryToVariant(category: Category): MarkerVariant {
  if (category.includes('QG')) return 'qg';
  if (category.includes('Beach Club')) return 'beach-club';
  if (category.includes('Restaurants')) return 'restaurant';
  if (category.includes('Bars')) return 'cocktail';
  if (category.includes('Ravitaillement')) return 'cannabis';
  if (category.includes('Plages')) return 'plage';
  if (category.includes('Escapades')) return 'mission-photo-principale';
  if (category.includes('Missions')) return 'course-depart';
  return 'mission-photo-principale';
}

/**
 * Marker variant for a specific spot. Photo spots branch on their `missionType`
 * (principale / annexe); every other spot falls back to its category default.
 * (Courses/races have their own pins — see MapContainer + coursesData.)
 */
export function locationVariant(loc: LocationItem): MarkerVariant {
  switch (loc.missionType) {
    case 'photo-principale':
      return 'mission-photo-principale';
    case 'photo-annexe':
      return 'mission-photo-annexe';
    default:
      return categoryToVariant(loc.category);
  }
}

/**
 * The shared teardrop SVG (head centred at 16,14 in a 32×38 box). The glyph is
 * scaled into the head; the rim gives the GTA-HUD white/cyan contour and the
 * drop-shadow matches the depth of the old pins.
 */
function buildPinSvg(fill: string, rim: string, glyphInner: string): string {
  return `<svg width="32" height="38" viewBox="0 0 32 38" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible;filter:drop-shadow(0 2px 3px rgba(0,0,0,.55));">
    <path d="M16 1.5C9 1.5 3.5 7 3.5 14 3.5 22 16 35 16 35S28.5 22 28.5 14C28.5 7 23 1.5 16 1.5Z" fill="${fill}" stroke="${rim}" stroke-width="2" stroke-linejoin="round"/>
    <g transform="translate(16 14) scale(0.86) translate(-10 -10)">${glyphInner}</g>
  </svg>`;
}

/**
 * Marker factory: one teardrop pin per variant.
 * Active = cyan rim + cyan ping ring + 1.16× scale. Completed = green ✓ badge.
 */
export function buildMarkerHtml(variant: MarkerVariant, isActive: boolean, isCompleted?: boolean): string {
  const v = MARKER_VARIANTS[variant] ?? MARKER_VARIANTS['mission-photo-principale'];
  const rim = isActive ? '#00F5D4' : '#FFFFFF';
  const scale = v.scale * (isActive ? 1.16 : 1);
  const pin = buildPinSvg(v.fill, rim, v.glyph(v.glyphColor, v.fill));

  return `
    <div class="relative flex items-center justify-center select-none" style="width:34px;height:34px;background:none!important;border:none!important;pointer-events:auto!important;">
      ${isActive ? `<div class="absolute rounded-full animate-ping" style="width:34px;height:34px;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(0,245,212,.25);z-index:-1;pointer-events:none!important;"></div>` : ''}
      <div style="transform:scale(${scale});pointer-events:auto;">${pin}</div>
      ${isCompleted ? `<div style="position:absolute;top:-3px;right:-3px;width:15px;height:15px;border-radius:50%;background:#46AE3C;border:1.5px solid #0a0a0b;color:#fff;font:800 9px sans-serif;display:flex;align-items:center;justify-content:center;z-index:5;pointer-events:none;">✓</div>` : ''}
    </div>
  `;
}

/**
 * Back-compat wrapper used by the map: resolves a data category to its default
 * variant. `label` is kept in the signature for call-site compatibility.
 */
export function getMarkerHtml(category: Category, isActive: boolean, _label: string, isCompleted?: boolean): string {
  return buildMarkerHtml(categoryToVariant(category), isActive, isCompleted);
}
