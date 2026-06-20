# Récapitulatif de session — Isla de la eterna primavera

> Document de passation. À donner à un Claude « normal » (sans le contexte de
> cette session) pour qu'il comprenne **tout** ce qui a été fait, pourquoi, et où
> en sont les choses. Lis aussi [`CLAUDE.md`](CLAUDE.md) (guide d'architecture du repo).

/ **App** : PWA mobile-first React 19 + TypeScript + Vite 6, compagnon de route
« GTA-like » pour Tenerife (carte Leaflet, missions chronométrées, trophées).
Pas de backend, tout en `localStorage`. Repo : `abtinemad/Isla-de-la-eterna-primavera`.
Le repo reçoit **aussi des pushes externes depuis Google AI Studio** → toujours
`git fetch` + `rebase` avant de pousser.

---

## Vue d'ensemble — 4 chantiers livrés

1. **Design tokens Manrique/Vice** (palette + fonds + thème).
2. **Migration de la palette catégories** vers les tokens.
3. **Toggle de thème dark/light** + vue Social Club theme-aware.
4. **Cover Quest** — refonte du Social Club en « jaquette » GTA + caméra géofencée,
   puis **réconciliation** avec un gros refactor poussé entre-temps par AI Studio,
   puis **notifications OS d'approche**.

Tout est mergé sur `main` et poussé. `npm run lint` (tsc) et `npm run build` passent.

---

## 1. Design tokens (commit `Design tokens Manrique/Vice + fonds`)

Fichiers créés :
- `src/styles/tokens.css` — variables CSS : palette Isla, couleurs par catégorie
  (`--cat-qg/ravito/bars/missions/escapades/plages/restaurants`), surfaces dark+light
  (`[data-theme="dark"|"light"]`), classe `.app-bg` (scrim + fresque Manrique en fond).
- `src/styles/tokens.js` — miroir JS des mêmes valeurs (palette/categories/typography/
  shape/themes) pour usage runtime éventuel.
- `public/assets/manrique-fields.svg` — fresque géométrique façon Manrique (fond dark).
- `public/assets/manrique-fields-light.svg` — même fresque, fond clair (`#F4F1EA`).

Câblage :
- Import `./styles/tokens.css` dans `src/main.tsx`.
- Polices Google (Space Grotesk, Inter, JetBrains Mono) dans `index.html`.
- `data-theme="dark"` sur `<html>` (défaut).

## 2. Migration palette (commit `Migrate category palette to Manrique/Vice tokens`)

Source unique de vérité : `src/utils/helper.ts` → `CATEGORY_MAP[cat].accentColor`
+ `BLIP_STYLE` (marqueurs carte). Anciennes couleurs sombres remplacées par la
palette Vice plus vive :

| Catégorie | Avant | Token |
|---|---|---|
| QG | `#D4AF37` | `#EDEFF2` (neutre — texte foncé sur surfaces claires) |
| Ravitaillement | `#1E4620` | `#46AE3C` |
| Bars | `#4B0082` | `#E0479B` |
| Missions | `#8B0000` | `#EA4423` |
| Escapades | `#008B8B` | `#9E7AD2` |
| Plages | `#005F73` | `#3F6CC4` |
| Restaurants | `#D9541E` | `#F0941E` (texte assombri `#C2710E` pour le contraste) |

Propagation automatique : pastilles (LocationsList), blips carte (`getMarkerHtml`),
QuickFilterBar, BottomSheet, cartes trophées — tous dérivent de `CATEGORY_MAP`.
Ajout d'un **liseré gauche** par catégorie sur les cartes de spots
(`src/components/LocationsList.tsx`, map `CATEGORY_RAIL` → variables `--cat-*`).

## 3. Toggle de thème (commit `Add dark/light theme toggle`)

- État `theme` dans `App.tsx`, persisté en `localStorage` clé **`isla_theme`**,
  défaut `dark`. `useEffect` pose `data-theme` sur `<html>`.
- Bouton ☀️/🌙 dans le header (à gauche du wallet).
- Vue **Social Club** rendue theme-aware : titre, widget de progression,
  séparateurs, bouton « Retourner » passés sur variables tokens (`var(--text)`,
  `var(--text-muted)`, `var(--hairline)`, `var(--glass-bg)`, `var(--surface)`).
- Les cartes de trophées restent en dark-glass dans les deux thèmes (choix assumé).

---

## 4. Cover Quest — la jaquette + caméra géofencée

### Concept
L'onglet « Social Club » ne montre plus une grille de trophées mais une **jaquette
façon GTA V** : montage inégal de panneaux + **logo central fixe** « GRAND TENERIFE
AUTO · IP » + barre de progression. Une case = un spot complétable.

### Décisions produit prises (NE PAS reposer ces questions)
- **11 cases**, **dérivées au runtime** des catégories complétables
  (Missions/Escapades/Plages) — pas de nombre codé en dur, pas de spots fictifs.
  QG/Ravitaillement/Bars/Restaurants n'ont **aucun** mécanisme de complétion → exclus.
- **Labels courts éditoriaux** confirmés (dans `src/coverData.ts`, `COVER_LABELS`) :
  TEIDE(7), MASCA(8), ANAGA(9), RADAZUL(12), EL MÉDANO(13), ABADES(10),
  HUMBOLDT(11), DIEGO H.(17), TERESITAS(18), DUQUE(19), ENRAMADA(20).
- **Filtre figé par catégorie** (teinte = couleur d'accent), pas de sélecteur de filtre.
- **Source photo** : caméra live prioritaire, **import galerie en secours**
  (le `getUserMedia` d'iOS Safari est capricieux).

### Règle non négociable — géofence
Une case ne se déverrouille / valide **que sur place** (présence GPS réelle). On
**réutilise** le géofence existant (`watchPosition`), pas de second système.

### Modèle de géofence FINAL (après réconciliation, voir §5)
- **Missions** → validées par le **chrono 50 m** sur la carte (ligne d'arrivée qui
  stoppe le chrono, code d'origine **conservé**). La case mission se remplit depuis
  cette complétion ; elle n'est **jamais** déverrouillable à la caméra dans la jaquette.
- **Escapades/Plages** → déverrouillables à la **caméra à < 500 m**
  (`PHOTO_UNLOCK_KM`, « paysages cadrés de loin », aligné sur la constante d'origine
  `PHOTO_VALIDATION_RADIUS_KM`).
- **Notification d'approche** : à l'entrée de zone d'une case non faite —
  **100 m** missions (`MISSION_APPROACH_KM`), **500 m** Escapades/Plages.

### Single source of truth
Le snap caméra (ou import galerie) **route par les handlers existants** :
`handleSavePhotoSouvenir` (→ `capturedPhotos[id]` en base64, persisté) +
`handleCompleteLocation` (→ `completedLocationIds`, `completedTimes`, overlay
« MISSION RÉUSSIE », chime, SMS). Aucun state dupliqué. `progress = filled / 11`.

### Fichiers
- `src/coverData.ts` — dérivation des 11 slots (`COVER_LOCATIONS`), `COVER_LABELS`,
  type `CoverSlot`, helpers `isPhotoSlot`, `approachRadiusKm`, constantes de rayon.
- `src/components/CoverQuest.tsx` — la jaquette (montage masonry `column-count`,
  tuiles `locked`/`unlockable`/`filled`, logo fixe overlay, footer progression épinglé).
- `src/components/CoverCamera.tsx` — overlay caméra plein écran : viseur `getUserMedia`,
  réticules d'angle, scanlines/vignette, bouton galerie de secours, filtre catégorie
  sur `<canvas>` (`contrast/saturate/brightness` + teinte accent en `overlay` 0.18).
- Câblage dans `App.tsx` : état `coverCameraSlot`, `handleCoverCommit`, rendu
  `<CoverCamera/>`, remplacement de la grille trophées par `<CoverQuest/>`.
- Helper partagé ajouté : `haversineKm` + `GEOFENCE_KM` dans `src/utils/helper.ts`.

---

## 5. Réconciliation avec les pushes AI Studio (⚠️ important)

Au moment de pousser, `origin/main` avait **6 nouveaux commits** d'AI Studio
(refactor lourd de `App.tsx`/`BottomSheet.tsx`/`LocationsList.tsx`, ajout de
`CLAUDE.md`, **fix du géofence missions**, passage du rayon photo à **500 m**).

→ `git fetch` + `git rebase origin/main`, conflits résolus selon ces arbitrages
**validés avec le PO** :
- **Garder le chrono missions d'origine** (ne pas annuler le fix externe). Les
  missions ne se valident donc PAS par la caméra ; elles se remplissent via le chrono.
- **Rayons** alignés sur le modèle documenté : photo 500 m / missions 50 m.
- **Notification d'approche** ajoutée (100 m missions / 500 m paysages).
- `CLAUDE.md` mis à jour avec une section Cover Quest + tokens/thème (pour les
  prochains éditeurs et AI Studio).

---

## 6. Notifications OS d'approche (dernier commit)

- `notifyOS()` dans `App.tsx` → **vraie notification OS** via
  `registration.showNotification` (fallback `new Notification()`), déclenchée depuis
  le `watchPosition` foreground. Permission demandée à l'ouverture du Social Club
  (geste requis sur iOS).
- `public/sw.js` **v2** : handler `notificationclick` (refocus/ouvre l'app) + bump cache.
- Le toast in-app reste le fallback si permission refusée.

> ⚠️ **Limite assumée** : une PWA ne peut **pas** géofencer en arrière-plan (le watch
> GPS ne tourne qu'app au premier plan ; iOS n'a pas de background-geolocation). La
> notif arrive donc app ouverte, pas app fermée. Une push app-fermée géofencée
> imposerait une app native / wrapper (Capacitor). Hors périmètre PWA.

---

## Vérifications effectuées (navigateur réel, Playwright + Chrome)

- Thèmes dark **et** light : Social Club lisible dans les deux, toggle persiste.
- Jaquette : 11 cases, montage + logo + footer ; à un GPS simulé, **exactement** les
  bonnes cases passent `unlockable` (1 case missions à 50 m AVANT réconciliation ;
  après réconciliation : missions jamais unlockable caméra, plages unlockable à 500 m).
- **Pipeline complet** : ouverture caméra → import galerie → filtre → overlay
  « MISSION RÉUSSIE » → case remplie → `progress` monte → `localStorage`
  (`tenirife_completed_locations`, `tenirife_captured_photos`) bien écrit.
- **Notif d'approche** : `Notification` déclenchée (`Zone atteinte · EL MÉDANO …`).
- **Build de prod** (`npm run preview`) : service worker **actif**, assets 200
  (`manrique-fields.svg`, `manifest.webmanifest`, `sw.js`), **0 erreur console**.

### Reste à tester (nécessite un vrai téléphone)
- Permission caméra **live** + géoloc réelle sur le déploiement **HTTPS** (Vercel) :
  case `locked` hors site, `unlockable` à portée, snap → filtre → validée.
  (Le fallback galerie et tout le reste sont déjà validés.)

---

## Conventions & pièges du repo (rappel)

- UI **en français**. Tailwind pour le style ; inline réservé aux valeurs dynamiques.
- Clés `localStorage` : `tenirife_completed_locations`, `tenirife_captured_photos`,
  `tenirife_completed_times` (préfixe « tenirife » historique, ne pas renommer) +
  `isla_theme` (thème).
- `INITIAL_LOCATIONS` = 25 entrées : 20 spots physiques (id 1-20) + 5 entrées
  trophées (id 101-105, catégorie `🏆…`) qui ne sont que des cibles « fly-to »
  (exclues des marqueurs/listes via `!category.startsWith('🏆')`). Ne pas les afficher.
- La console « IA » du BottomSheet est **décorative** : aucun appel LLM réel, aucune
  clé API. Ne pas réintroduire de fausses mentions Gemini/Vision.
- **Toujours `git fetch` + rebase avant de pousser** (pushes AI Studio).
- Vérifier avec `npm run lint` **et** `npm run build` (le build attrape des erreurs
  JSX que le lint seul rate).

## Idées / suites possibles

- Tester la caméra live sur déploiement HTTPS réel (téléphone).
- Cartes de trophées en thème light « vrai light » (actuellement dark-glass assumé).
- Push géofencée app-fermée → nécessiterait du natif (Capacitor) : à chiffrer.
