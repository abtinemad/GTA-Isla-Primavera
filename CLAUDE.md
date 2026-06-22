# CLAUDE.md

Guide pour travailler sur ce dépôt. Lis-le avant de modifier le code.

## Le projet

**Isla de la eterna primavera** (titre HTML : « Grand Tenerife Auto : Isla Primavera ») :
PWA mobile-first, compagnon de route interactif pour Tenerife façon carte-pause
de jeu vidéo (GTA-like). Missions de conduite chronométrées, safehouses,
ravitaillement, bars, restaurants, plages et trophées sur une carte Leaflet.

Pas de backend : tout tourne côté client. La progression est persistée en
`localStorage`. La géolocalisation sert au tri par distance et au géofencing
(Missions : chrono qui s'arrête à < 50 m ; Escapades/Plages : photo validée à
< 500 m, car ces paysages se cadrent de loin).

## Stack

- **React 19** + **TypeScript**, build **Vite 6**
- **Leaflet** (carte) — tuiles Esri World Imagery (vue satellite) et CARTO
  Voyager (vue plan)
- **Tailwind CSS v4** via `@tailwindcss/vite` (pas de postcss/autoprefixer)
- **motion** (animations), **lucide-react** (icônes)

## Commandes

| Commande          | Rôle                                          |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Serveur de dev Vite sur http://localhost:3000 |
| `npm run build`   | Build de production → `dist/`                 |
| `npm run preview` | Sert le build de prod                         |
| `npm run lint`    | Vérification de types (`tsc --noEmit`)        |
| `npm run clean`   | Supprime `dist/`                              |

Après toute modif : lancer `npm run lint` ET `npm run build` (le build attrape
des erreurs que le lint seul ne voit pas dans le JSX).

## Architecture

Tout l'état vit dans `src/App.tsx` (composant racine, pas de lib d'état).

- `src/App.tsx` — état global, HUD, onglets (carte / liste / Social Club),
  chrono des missions, géofencing, sons (Web Audio), modale wallet, overlays.
- `src/components/MapContainer.tsx` — carte Leaflet : tuiles, marqueurs,
  ligne d'itinéraire néon, bascule satellite/plan. Effets Leaflet impératifs
  (refs), pas de wrapper React.
- `src/components/BottomSheet.tsx` — fiche d'un spot : infos, chrono, **co-
  validation photo + GPS** (voir ci-dessous), partage, itinéraire Google Maps.
- `src/components/LocationsList.tsx` — liste des spots (tri par distance),
  panneau « Trophées Disponibles », télémétrie canarienne.
- `src/components/QuickFilterBar.tsx` — filtres par catégorie.
- `src/locationsData.ts` — **source de vérité des spots** (`INITIAL_LOCATIONS`).
- `src/roadsData.ts` — tracés des routes TF (polylignes).
- `src/utils/helper.ts` — `CATEGORY_MAP` (couleurs/emojis par catégorie) et
  `buildMarkerHtml` (HTML des « blips » de la carte, via `locationVariant`).
- `src/types.ts` — types (`Category`, `LocationItem`).
- `public/sw.js` — service worker (offline : shell network-first, assets
  stale-while-revalidate, tuiles cache-first plafonnées). Enregistré **en prod
  uniquement** (`src/main.tsx`).

## Modèle de données — important

`INITIAL_LOCATIONS` contient **30 entrées** = **25 spots physiques** (ids 1-27,
10 et 11 retirés) + **5 entrées trophées** (id 101-105, catégorie commençant par `🏆`).

- Les entrées trophées **dupliquent les coordonnées** d'un spot physique et ne
  servent **que de cibles « fly-to »** pour le panneau « Trophées Disponibles ».
  Elles sont **exclues** des marqueurs carte et des cartes de liste (filtre
  `!category.startsWith('🏆')`). Ne pas les réintroduire comme spots affichés.
- Seules les catégories **Missions / Escapades / Plages** sont **complétables**
  (chrono géofencé pour Missions ; co-validation photo pour Escapades/Plages) →
  **13 spots complétables**. Le `% complétion` se calcule sur ce sous-ensemble,
  pas sur les 30 entrées. (Beach Club, comme QG/Bars/Restaurants/Ravitaillement,
  n'est **pas** complétable.)

## Co-validation photo + GPS

C'est le mécanisme réel de validation des Escapades/Plages :
1. l'utilisateur doit être à **< 500 m** du spot (constante `PHOTO_VALIDATION_RADIUS_KM`
   dans `BottomSheet.tsx` — large car ce sont des paysages cadrés de loin) ;
2. il prend/charge une photo (compressée, stockée en base64 dans `localStorage`).

Les **Missions** utilisent un géofence distinct et plus serré (**50 m**) dans
`App.tsx` : c'est la ligne d'arrivée qui stoppe le chrono.

La console animée dans `BottomSheet` est purement décorative : **il n'y a aucun
appel à une IA / un LLM**. Ne pas réintroduire de fausses mentions « Gemini /
Vision / confidence ». Aucune clé API n'est requise.

## Cover Quest — la jaquette (vue Social Club)

L'onglet « Social Club » rend `src/components/CoverQuest.tsx` : une **jaquette
façon GTA V** (montage inégal de panneaux + logo central fixe « GRAND TENERIFE
AUTO · IP » + barre de progression). Une case = un des **13 spots complétables**,
dérivés au runtime **dans `CoverQuest` à partir de `INITIAL_LOCATIONS`**. Libellés
courts éditoriaux et helpers de géofence dans `src/coverData.ts` (`COVER_LABELS`,
`shortLabel`, `isPhotoSlot`, `approachRadiusKm`). **Pas de seconde source de
vérité** : une case est `filled` quand `completedLocationIds` contient son id ;
`progress = filled / 13`.

États d'une case et **rayons de déverrouillage** (alignés sur le modèle ci-dessus) :
- **Escapades/Plages** → `unlockable` à **< 500 m** (`PHOTO_UNLOCK_KM`). La caméra
  plein écran `src/components/CoverCamera.tsx` (live `getUserMedia` + secours import
  galerie) applique le filtre catégorie sur `<canvas>` puis route par les handlers
  **existants** (`handleSavePhotoSouvenir` + `handleCompleteLocation`). C'est le
  front-end de la co-validation, pas un système parallèle.
- **Missions** → **jamais** déverrouillables à la caméra. Elles se valident par le
  chrono 50 m sur la carte (inchangé) ; leur case se remplit depuis cette complétion.
- Une **notification d'approche** (toast QG, `App.tsx` watchPosition) se déclenche à
  l'entrée de zone d'une case non faite : **100 m** missions, **500 m** Escapades/Plages.

## Thème & design tokens

`src/styles/tokens.css` (+ miroir JS `src/styles/tokens.js`) définit la palette
Manrique/Vice et les variables par catégorie (`--cat-*`). Le thème se bascule via
`data-theme="dark|light"` sur `<html>` (toggle dans le HUD, persisté en
`localStorage` clé `isla_theme`). `CATEGORY_MAP[cat].accentColor` (dans `helper.ts`)
porte les couleurs catégorie ; `haversineKm`/`GEOFENCE_KM` y centralisent la distance.

## Workflow git — ⚠️ pushes externes

Le dépôt `abtinemad/Isla-de-la-eterna-primavera` est **aussi édité depuis Google
AI Studio**, qui pousse directement des commits (ex. « V6 ») sur `main`.
**Toujours `git fetch` + rebase avant de pousser.** Les conflits probables sont
dans les fichiers carte (`MapContainer.tsx`, `roadsData.ts`, `index.css`).

## Conventions

- Interface et textes utilisateur en **français**.
- Tailwind pour le style ; styles inline réservés aux valeurs dynamiques
  (couleurs de catégorie, largeurs de barres).
- Effets Leaflet impératifs via `useRef` — penser au cleanup (remove) dans le
  retour des `useEffect`.
- Clés `localStorage` : préfixe `tenerife_` (ex. `tenerife_completed_locations`,
  `tenerife_captured_photos`, `tenerife_completed_times`). L'ancien préfixe
  mal orthographié `tenirife_` est renommé une fois au démarrage par
  `migrateLegacyKeys()` (`src/utils/storage.ts`) — ne pas renommer à nouveau sans
  migration.
- **Photos de course** : stockées en **IndexedDB** (`src/utils/storage.ts`,
  base `tenerife` / store `course_photos`), pas en `localStorage` — le base64 est
  trop lourd pour le quota (~5 Mo). Hydratées au montage via `loadCoursePhotos()`,
  écrites via `putCoursePhoto()`. Les ids de complétion restent en `localStorage`.
