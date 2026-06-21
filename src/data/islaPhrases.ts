/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Aphorismes « Isla Primavera » — registre deadpan IMPERSONNEL (vouvoiement),
 * dans le ton de l'ASTUCE de l'overlay de chargement du splash.
 *
 * SOURCE UNIQUE pour la rotation discrète en bas de carte (cf. MapContainer).
 *
 * ⚠️ GARDER SYNCHRO : la 1re entrée est IDENTIQUE à l'ASTUCE affichée par
 * `SplashScreen` (bloc `.ld-tip-body`). Le splash garde sa phrase en dur (un seul
 * texte, pas un tableau) : si tu modifies l'une, mets l'autre à jour.
 */
export const ISLA_PHRASES: string[] = [
  // == garder synchro avec SplashScreen .ld-tip-body ==
  "Sur Isla Primavera, le coucher de soleil n'attend personne. Roulez vite, vivez lentement.",
  "Ici, on double avec élégance et on klaxonne avec parcimonie.",
  "Une belle route ne se presse pas. Elle se savoure, virage après virage.",
  "À Isla Primavera, l'asphalte est chaud, les esprits restent froids.",
  "Le plus court chemin n'est jamais le plus beau. Prenez le beau.",
  "On ne conquiert pas l'île. On s'y laisse inviter.",
  "Un détour bien choisi vaut mieux qu'une ligne droite bien roulée.",
  "Le luxe, ici, c'est d'avoir le temps de s'arrêter regarder.",
  "Roulez comme si personne ne regardait. L'île, elle, vous observe.",
];
