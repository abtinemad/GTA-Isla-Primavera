/**
 * Denzel Sag — alias El Jefe, alias le chien. Le boss d'Isla Primavera.
 * ------------------------------------------------------------------
 * DEUX REGISTRES :
 *
 *  1. MOMENTS D'ACTION (reopen / photo / chrono) — SIMPLE et DIRECT.
 *     Sag parle à Noémie pour lui dire de faire le truc, point.
 *
 *  2. AMBIANCE (nudges / flavor) — voix « loi de l'île », deadpan.
 *
 * Plus : DIDACTICIEL (denzelTutorial) — onboarding guidé, une seule fois.
 *
 * PANELS :
 *  Chaque message renvoyé est un DenzelLine { text, panel }. `panel` est une
 *  PanelKey qui désigne l'illustration à afficher EN FOND de la fenêtre de
 *  message. Les phrases « flavor » sont groupées par panel (plusieurs phrases
 *  par illustration) ; les messages d'action et les nudges prennent par défaut
 *  le panel "eljefe".
 *
 * RÈGLES COMMUNES :
 *  - El Jefe = Denzel = un seul personnage. C'est un chien, joué droit.
 *  - Denzel TUTOIE Noémie. (Le vouvoiement est réservé aux menus / à l'UI.)
 *
 * Usage :
 *   import { getDenzelAmbient, PANEL_FILES } from "./denzelMessages";
 *   const line = getDenzelAmbient();   // { text, panel }
 *   // -> afficher PANEL_FILES[line.panel] en fond, line.text par-dessus.
 */

/* ------------------------------------------------------------------ *
 *  PANELS                                                             *
 * ------------------------------------------------------------------ */

export type PanelKey =
  | "boat"
  | "happy"
  | "teide"
  | "car"
  | "corales"
  | "arsenal"
  | "eljefe"
  | "couple";

/**
 * Nom de fichier de chaque panel. Côté composant, mappe ces clés vers tes
 * imports d'assets (ex. import boat from "../assets/panels/panel-boat.webp").
 */
export const PANEL_FILES: Record<PanelKey, string> = {
  boat: "panel-boat.webp",
  happy: "panel-happy.webp",
  teide: "panel-teide.webp",
  car: "panel-car.webp",
  corales: "panel-corales.webp",
  arsenal: "panel-arsenal.webp",
  eljefe: "panel-eljefe.webp",
  couple: "panel-couple.webp",
};

/** Un message de Sag + le panel à afficher en fond. */
export interface DenzelLine {
  text: string;
  panel: PanelKey;
}

/** Panel par défaut quand Sag s'adresse direct à Noémie (le narrateur). */
const SPEAKER_PANEL: PanelKey = "eljefe";

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

/** À l'ouverture sans rien en cours : inciter à découvrir, sans être lourd. */
export const denzelNudges: string[] = [
  "Isla Primavera ne se découvre pas depuis le canapé. Ta caisse t'attend.",
  "Y a des coins de l'île que t'as pas encore salués. Ils commencent à se vexer.",
  "El Jefe s'ennuie. Lance une mission, qu'on se dégourdisse les pattes.",
  "La carte est pleine de pins qui dorment. Va en réveiller un.",
  "T'as des spots à découvrir et un soleil qui descend. Fais le calcul, et démarre.",
  "Le Corales ne viendra pas à toi. C'est toi qui descends jusqu'au Corales.",
  "Une mission de finie, c'est un souvenir de plus. On y va ?",
  "El Teide t'a à l'œil depuis ce matin. Donne-lui quelque chose à regarder : roule.",
];

/**
 * Du « n'importe quoi » d'ambiance, groupé PAR panel : chaque panel a plusieurs
 * phrases qui collent à son illustration. Le tirage choisit un panel (anti-
 * répétition), puis une phrase dans ce panel (anti-répétition aussi).
 */
export const flavorByPanel: { panel: PanelKey; lines: string[] }[] = [
  {
    panel: "couple",
    lines: [
      "Tirer la langue à Isla Primavera n'est pas un délit. Klaxonner dans un rond-point, si.",
      "Sur Ocean Drive, les néons ne s'éteignent jamais. Les amoureux non plus.",
      "Le meilleur cliché du séjour, c'est celui qu'on prend à deux, au hasard, sans réfléchir.",
    ],
  },
  {
    panel: "corales",
    lines: [
      "Au Corales, l'addition se règle en liquide. Garde un œil sur la flicaille.",
      "La piscine du Corales ne ferme jamais pour les gens bien. Et tu es des gens bien.",
      "Un transat, un cocktail, zéro urgence. Au Corales, c'est ça, le luxe.",
    ],
  },
  {
    panel: "eljefe",
    lines: [
      "El Jefe ne court pas après les voitures. Les voitures s'arrêtent pour El Jefe.",
      "On raconte qu'El Jefe a déjà mordu un radar. Le radar n'a pas porté plainte.",
      "El Jefe ne dort jamais vraiment. Un œil sur la banquette, l'autre sur le large.",
    ],
  },
  {
    panel: "car",
    lines: [
      "Une œuvre d'art roule à 240. La police d'Isla Primavera n'ose pas la rayer.",
      "Sur le sable d'Isla Primavera, même les belles caisses se garent comme des tableaux.",
      "La belle bagnole ne se conduit pas. Elle se mérite, virage après virage.",
    ],
  },
  {
    panel: "happy",
    lines: [
      "Un espresso martini te tient éveillée. Le reste de la table s'en charge dans l'autre sens.",
      "Le café se boit serré, la nuit se prend large. À Isla Primavera, on sait faire les deux.",
      "Un dernier verre, ça n'existe pas. C'est juste l'avant-dernier qui se vante.",
    ],
  },
  {
    panel: "arsenal",
    lines: [
      "Deux béquilles et dix ongles. À Isla Primavera, on ne sort jamais désarmée.",
      "Ici, l'élégance, c'est dix ongles affûtés et un sourire en coin.",
      "On reconnaît une reine d'Isla Primavera à ses ongles. Et à son culot.",
    ],
  },
  {
    panel: "teide",
    lines: [
      "Le plus haut sommet d'Espagne veille sur l'île. Personne ne dépasse El Teide.",
      "El Teide a vu passer des empires. Toi, tu lui passes devant en troisième. Respect.",
      "Quand le ciel s'embrase derrière El Teide, même les durs s'arrêtent pour regarder.",
    ],
  },
  {
    panel: "boat",
    lines: [
      "Les dauphins escortent les bateaux jusqu'au port. Ils prennent leur part en poisson.",
      "La mer d'Isla Primavera est en règle. Les dauphins veillent au grain.",
      "Sous la coque, les dauphins t'ouvrent la route. Au-dessus, le soleil fait le reste.",
    ],
  },
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
   * son attribut `data-tour`. `null` = étape plein écran, centrée, sans spotlight.
   */
  target: string | null;
  /** Placement indicatif de la carte par rapport à la cible (auto si déborde). */
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

/**
 * Onboarding GUIDÉ raconté par Sag, à dérouler DANS L'ORDRE, UNE SEULE FOIS.
 * Ancres `data-tour` attendues dans l'UI : "map", "social-club", "spots".
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
    title: "Les spots",
    message:
      "Et ici, mes adresses : les bons restos, les bons bars. Chaque mission accomplie t'en débloque dans le coin. Garde un œil sur le compteur de spots.",
    target: "spots",
    placement: "bottom",
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
 * Fabrique un tireur générique qui évite les `recentMemory` derniers éléments.
 * Mémoire conservée pendant la session (réinitialisée au rechargement complet).
 */
function createRotator<T>(pool: T[], recentMemory = 3): () => T {
  let recent: number[] = [];
  return () => {
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

// Flavor : un rotateur sur les panels (groupes), + un rotateur de phrases par panel.
const nextFlavorGroup = createRotator(flavorByPanel);
const flavorLineRotators = new Map<PanelKey, () => string>(
  flavorByPanel.map((g) => [g.panel, createRotator(g.lines)] as const),
);

/** Choisit un panel (anti-répétition), puis une phrase de ce panel. */
function nextFlavor(): DenzelLine {
  const group = nextFlavorGroup();
  const text = flavorLineRotators.get(group.panel)!();
  return { text, panel: group.panel };
}

/* ------------------------------------------------------------------ *
 *  API PUBLIQUE  — renvoie toujours un DenzelLine { text, panel }     *
 * ------------------------------------------------------------------ */

/** « Y aller » : rouvre-moi une fois sur place. */
export function getDenzelReopenPrompt(): DenzelLine {
  return { text: nextReopen(), panel: SPEAKER_PANEL };
}

/** Mission photo : prends la photo. */
export function getDenzelPhotoPrompt(): DenzelLine {
  return { text: nextPhoto(), panel: SPEAKER_PANEL };
}

/** Mission chrono : lance le chrono. */
export function getDenzelChronoPrompt(): DenzelLine {
  return { text: nextChrono(), panel: SPEAKER_PANEL };
}

/**
 * Ouverture sans mission active. `nudgeChance` règle la part de nudges
 * (incitation, panel "eljefe") vs flavor (décor, panel accordé). Défaut 0.35.
 */
export function getDenzelAmbient(nudgeChance = 0.35): DenzelLine {
  if (Math.random() < nudgeChance) {
    return { text: nextNudge(), panel: SPEAKER_PANEL };
  }
  return nextFlavor();
}

/* ------------------------------------------------------------------ *
 *  Photos « ambiance » de spots — ligne propre au lieu (par id).      *
 * ------------------------------------------------------------------ */

/** Lignes Denzel à la capture d'une photo « ambiance », indexées par id de spot. */
export const denzelSpotPhotoLines: Record<number, string> = {
  2: "Le seul Social Club où le patron est un chien. Profil bas, respect maximal.",
};

/** Photo d'ambiance d'un spot : ligne spécifique si fournie, sinon générique. */
export function getDenzelSpotPhotoLine(spotId: number): DenzelLine {
  const text = denzelSpotPhotoLines[spotId] ?? "Belle prise. Direction la collection.";
  return { text, panel: SPEAKER_PANEL };
}

/* ------------------------------------------------------------------ *
 *  Wallet — tap sur le solde (HUD carte)                             *
 * ------------------------------------------------------------------ */

/** Réplique fixe d'El Jefe au tap sur le portefeuille (solde négatif). */
export const denzelWalletMessage: DenzelLine = {
  text:
    "Ton solde est négatif ? Parfait. L'argent attire les ennuis. S'il te manque quoi que ce soit, demande à ton mari.",
  panel: SPEAKER_PANEL,
};
