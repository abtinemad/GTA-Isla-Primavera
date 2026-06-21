/**
 * Denzel Sag — alias El Jefe, alias le chien. Le boss d'Isla Primavera.
 * ------------------------------------------------------------------
 * DEUX REGISTRES :
 *
 *  1. MOMENTS D'ACTION (reopen / photo / chrono) — SIMPLE et DIRECT.
 *     Sag parle à Noémie pour lui dire de faire le truc, point. Court, clair,
 *     une pointe de caractère, aucune poésie.
 *
 *  2. AMBIANCE (nudges / flavor) — voix « loi de l'île ».
 *     Deux temps, chute deadpan, même carnet que les phrases de chargement.
 *     Univers Isla Primavera (El Teide, dauphins, flicaille, Corales, coucher
 *     de soleil, ronds-points).
 *
 * Plus : DIDACTICIEL (denzelTutorial) — onboarding séquentiel raconté par Sag,
 * montré une seule fois à la première ouverture.
 *
 * RÈGLES COMMUNES :
 *  - El Jefe = Denzel = un seul personnage. C'est un chien, joué droit (pas de « ouaf »).
 *  - Denzel TUTOIE Noémie. (Le vouvoiement est réservé aux menus / à l'UI.)
 *
 * Usage :
 *   import {
 *     getDenzelReopenPrompt, getDenzelPhotoPrompt,
 *     getDenzelChronoPrompt, getDenzelAmbient,
 *   } from "./denzelMessages";
 */

/* ------------------------------------------------------------------ *
 *  1. MOMENTS D'ACTION — simple et direct                            *
 * ------------------------------------------------------------------ */

/** Au « Y aller » : lui dire de rouvrir l'app une fois arrivée. */
export const denzelReopenPrompts: string[] = [
  "Une fois sur place, rouvre-moi. On s'y met.",
  "T'es arrivée ? Reviens dans l'app, je te briefe.",
  "Gare-toi, coupe le moteur, et reviens me voir.",
  "Sur zone, tu me rouvres. Je t'attends.",
  "Quand t'y es, rouvre l'app. On a à faire.",
  "Arrivée = tu reviens vers moi. Simple.",
];

/** Pendant une mission photo : lui dire de prendre la photo. */
export const denzelPhotoPrompts: string[] = [
  "C'est le moment. Sors le téléphone et prends la photo.",
  "Cadre bien, et shoote.",
  "Là, devant toi. Prends-la en photo.",
  "Une belle photo, et c'est plié.",
  "Immortalise-moi ça.",
  "Photo, maintenant. Tu me remercieras sur la jaquette.",
];

/** Pendant une mission chrono : lui dire de lancer le chrono. */
export const denzelChronoPrompts: string[] = [
  "Prête ? Lance le chrono et fonce.",
  "Moteur, chrono, et go.",
  "Le chrono t'attend. À toi de jouer.",
  "Démarre le chrono. Montre-moi ce que tu vaux.",
  "Quand tu veux : tu démarres le chrono.",
  "Top chrono dès que t'es chaude.",
];

/* ------------------------------------------------------------------ *
 *  2. AMBIANCE — voix « loi de l'île »                               *
 * ------------------------------------------------------------------ */

/** À l'ouverture sans rien en cours : inciter à aller découvrir, sans être lourd. */
export const denzelNudges: string[] = [
  "Isla Primavera ne se découvre pas depuis le canapé. Ta caisse t'attend.",
  "Y a des coins de l'île que t'as pas encore salués. Ils commencent à se vexer.",
  "El Jefe s'ennuie. Lance une mission, qu'on se dégourdisse les pattes.",
  "La carte est pleine de pins qui dorment. Va en réveiller un.",
  "T'as des spots à découvrir et un soleil qui descend. Fais le calcul, et démarre.",
  "Le Corales ne viendra pas à toi. C'est toi qui descends jusqu'au Corales.",
  "Une mission de finie, c'est un souvenir de plus pour la jaquette. On y va ?",
  "El Teide t'a à l'œil depuis ce matin. Donne-lui quelque chose à regarder : roule.",
];

/** Du « n'importe quoi » d'ambiance. Pas de call to action, juste le décor. */
export const denzelFlavor: string[] = [
  "À Isla Primavera, le café se boit serré et les ronds-points se prennent large.",
  "On raconte qu'El Jefe a déjà mordu un radar. Le radar n'a pas porté plainte.",
  "Les dauphins ont encore pris leur part ce matin. La mer est en règle.",
  "Le vent d'est sent l'essence et le laurier. C'est l'odeur de l'île qui se réveille.",
  "El Jefe ne dort jamais vraiment. Un œil sur la banquette, l'autre sur le large.",
  "Ici, personne ne demande l'heure. Le soleil s'en occupe, et il ne se trompe pas.",
  "Un bon séjour, c'est dix ongles propres et zéro regret. On en est loin, c'est parfait.",
  "El Teide a vu passer des empires. Toi, tu lui passes devant en troisième. Respect.",
  "La flicaille d'Isla Primavera roule en diesel. El Jefe, lui, roule à l'instinct.",
  "Quelque part sur l'île, un espresso martini porte ton nom. Il est patient.",
];

/* ------------------------------------------------------------------ *
 *  3. DIDACTICIEL — première ouverture                               *
 * ------------------------------------------------------------------ */

export interface DenzelTutorialStep {
  /** Titre court de l'étape (sert d'en-tête). */
  title: string;
  /** La réplique de Sag pour cette étape. */
  message: string;
  /**
   * Élément de l'UI à mettre en lumière (spotlight), désigné par la valeur de
   * son attribut `data-tour`. `null` = étape plein écran, centrée, sans spotlight
   * (intro / clôture / concepts).
   */
  target: string | null;
  /**
   * Placement indicatif de la carte de dialogue par rapport à la cible.
   * Le composant peut recalculer en auto si ça déborde. Ignoré si target = null
   * (l'étape est alors centrée).
   */
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

/**
 * Onboarding GUIDÉ raconté par Sag, à dérouler DANS L'ORDRE, UNE SEULE FOIS,
 * à la toute première ouverture. (Séquentiel : pas de tirage aléatoire.)
 *
 * Ancres `data-tour` attendues dans l'UI : "map", "social-club", "progress".
 * Les étapes sans target sont des panneaux plein écran centrés.
 */
export const denzelTutorial: DenzelTutorialStep[] = [
  {
    title: "Bienvenue à Isla Primavera",
    message:
      "Moi, c'est El Jefe. Je règne sur cette île — et à partir d'aujourd'hui, je veille sur toi. Bienvenue chez moi, Noémie.",
    target: null,
    placement: "center",
  },
  {
    title: "Le deal",
    message:
      "Ici, on roule, on découvre, on garde une trace. Chaque mission accomplie te laisse une photo. Au bout du séjour, elles formeront ta jaquette souvenir. Voilà le but.",
    target: null,
    placement: "center",
  },
  {
    title: "La carte",
    message:
      "Voici ton terrain. Tu y choisis une mission, je te file le trajet — courses chrono, points de vue, ou découvertes plus discrètes. Une fois sur place, tu me rouvres : je te briefe.",
    target: "map",
    placement: "bottom",
  },
  {
    title: "Le Social Club",
    message:
      "Là, c'est le Social Club. Toutes tes photos y atterrissent, déjà passées au filtre maison. Elles prennent le style d'Isla Primavera toutes seules.",
    target: "social-club",
    placement: "top",
  },
  {
    title: "Ta progression",
    message:
      "Et ça, c'est ta jauge. Plus tu boucles de missions, plus elle grimpe — et tu débloques mes adresses au passage. Garde un œil sur le compteur de spots.",
    target: "progress",
    placement: "bottom",
  },
  {
    title: "Ta jaquette",
    message:
      "Quand le séjour touche à sa fin, tu composes ta jaquette avec tout ce que t'as ramené. C'est ton souvenir : à garder, ou à partager.",
    target: null,
    placement: "center",
  },
  {
    title: "À toi de jouer",
    message:
      "Allez, Noémie. L'île est à toi. Coupe le moteur quand il faut, prends de belles photos, et profite. El Jefe te suit.",
    target: null,
    placement: "center",
  },
];

/* ------------------------------------------------------------------ *
 *  TIRAGE ANTI-RÉPÉTITION                                             *
 * ------------------------------------------------------------------ */

/**
 * Fabrique un tireur qui évite les `recentMemory` derniers messages d'un pool.
 * Mémoire conservée pendant la session (réinitialisée au rechargement complet).
 */
function createRotator(pool: string[], recentMemory = 3): () => string {
  let recent: number[] = [];
  return () => {
    if (pool.length === 0) return "";

    let candidates = pool.map((_, i) => i).filter((i) => !recent.includes(i));
    if (candidates.length === 0) {
      const last = recent[recent.length - 1];
      candidates = pool.map((_, i) => i).filter((i) => i !== last);
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    recent.push(pick);
    if (recent.length > recentMemory) recent.shift();
    return pool[pick];
  };
}

const nextReopen = createRotator(denzelReopenPrompts);
const nextPhoto = createRotator(denzelPhotoPrompts);
const nextChrono = createRotator(denzelChronoPrompts);
const nextNudge = createRotator(denzelNudges);
const nextFlavor = createRotator(denzelFlavor);

/* ------------------------------------------------------------------ *
 *  API PUBLIQUE                                                       *
 * ------------------------------------------------------------------ */

/** « Y aller » : rouvre-moi une fois sur place. */
export function getDenzelReopenPrompt(): string {
  return nextReopen();
}

/** Mission photo : prends la photo. */
export function getDenzelPhotoPrompt(): string {
  return nextPhoto();
}

/** Mission chrono : lance le chrono. */
export function getDenzelChronoPrompt(): string {
  return nextChrono();
}

/**
 * Ouverture sans mission active. `nudgeChance` règle la part de nudges
 * (incitation) vs flavor (décor). Par défaut 0.35 : surtout du décor.
 */
export function getDenzelAmbient(nudgeChance = 0.35): string {
  return Math.random() < nudgeChance ? nextNudge() : nextFlavor();
}
