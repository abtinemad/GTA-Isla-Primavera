# Grand Tenerife Auto : Isla Primavera — Récapitulatif complet de l'app

> Document de référence à faire lire à un assistant (Claude) sans contexte. Il
> décrit **tout** : ce qu'est l'app, sa stack, son modèle de données, ses
> fonctionnalités, son design, ses pièges. Complète [`CLAUDE.md`](CLAUDE.md)
> (guide d'architecture court) — ici c'est la vue d'ensemble exhaustive.
> Repo : `abtinemad/Isla-de-la-eterna-primavera`. UI **en français**.

---

## 1. C'est quoi

**Grand Tenerife Auto : Isla Primavera** (nom user-facing ; identité repo/package =
« Isla de la eterna primavera ») est une **PWA mobile-first** : un compagnon de
road-trip interactif pour **Tenerife**, présenté comme une **carte-pause de jeu
vidéo façon GTA**. On conduit sur l'île, on valide des spots **sur place** (GPS),
on chronomètre des missions, on collectionne des « trophées » sous forme d'une
**jaquette** (cover) à compléter.

- **Aucun backend.** Tout tourne côté client. Progression persistée en `localStorage`.
- **Aucun appel LLM/IA.** (La console « IA » de la fiche spot est purement décorative.)
- **Aucune clé API requise.**
- Mobile-first, installable (PWA), fonctionne hors-ligne (service worker).

## 2. Stack & commandes

- **React 19** + **TypeScript**, build **Vite 6**.
- **Leaflet** (carte ; tuiles Esri World Imagery satellite + CARTO Voyager plan).
- **Tailwind CSS v4** via `@tailwindcss/vite`.
- **motion** (`motion/react`) pour les animations, **lucide-react** pour les icônes.
- Pas de routeur (mono-page, navigation par onglets en state), pas de lib d'état
  (tout l'état vit dans `src/App.tsx`).

| Commande | Rôle |
|---|---|
| `npm run dev` | Dev server Vite — http://localhost:3000 |
| `npm run build` | Build prod → `dist/` |
| `npm run preview` | Sert le build prod (le service worker s'enregistre ici) |
| `npm run lint` | Typecheck `tsc --noEmit` |
| `npm run clean` | Supprime `dist/` |

> ⚠️ **Toujours `npm run lint` ET `npm run build`** après une modif (le build
> attrape des erreurs JSX que le lint seul rate).

## 3. Modèle de données (important)

`src/locationsData.ts` → `INITIAL_LOCATIONS` = **25 entrées** :
- **20 spots physiques** (id 1-20) : QG, Ravitaillement, Bars, Missions, Escapades,
  Plages, Restaurants.
- **5 entrées « trophées »** (id 101-105, catégorie commençant par `🏆`) qui
  **dupliquent** les coordonnées d'un spot et ne servent que de cibles « fly-to »
  pour le panneau « Trophées Disponibles ». **Exclues** des marqueurs carte et des
  listes (`!category.startsWith('🏆')`). Ne jamais les afficher comme spots.

**Complétables = 11 spots** seulement : catégories **Missions / Escapades / Plages**
(les seules avec un mécanisme de validation). QG / Ravitaillement / Bars /
Restaurants n'ont **aucun** chemin de complétion. Le `% complétion` se calcule sur
ces 11, pas sur les 25.

Types : `src/types.ts` (`Category`, `LocationItem`).

## 4. Validation sur place — le géofence (l'âme du projet)

On ne valide un spot que si on y est **physiquement** (GPS). Deux mécanismes :

- **Missions** → **chrono géofencé 50 m** : on lance le run (bouton dans la fiche),
  on roule jusqu'au spot ; en entrant dans le rayon de **50 m**, le chrono s'arrête
  et la mission se valide (temps enregistré). Logique dans `App.tsx` (`watchPosition`).
- **Escapades / Plages** → **co-validation photo à < 500 m** (`PHOTO_VALIDATION_RADIUS_KM`
  dans `BottomSheet.tsx`) : rayon large car ce sont des **paysages cadrés de loin**.
  On prend/charge une photo (compressée, base64, `localStorage`).

> La distance est centralisée : `haversineKm` + `GEOFENCE_KM` (50 m) dans
> `src/utils/helper.ts`.

## 5. Écrans & fonctionnalités

### Boot — Splash (`src/components/SplashScreen.tsx`)
Au lancement, plein cadre, l'**artwork GTA déjà titré** (`public/assets/splash.webp`,
« GRAND TENERIFE AUTO / Isla Primavera » baké dans l'image) ; fond `#14100C`
anti-flash, `object-position: center top` (protège le titre), indicateur discret
« CHARGEMENT… ». Entrée opacity+scale, sortie fade 0.5s via `AnimatePresence`.
Timer ~2200 ms (1400 ms si `prefers-reduced-motion`). Se **rejoue à chaque boot**
(pas de « show once »). Préchargé (`<link rel=preload>` + précache service worker).

### Onglet Carte (`src/components/MapContainer.tsx`)
Carte Leaflet plein écran (effets impératifs via refs). Marqueurs « blips » plats
par catégorie (`getMarkerHtml` dans `helper.ts`), bascule satellite/plan, ligne
d'itinéraire néon, recentrage auto. HUD flottant en haut : barre **% COMPLETION**,
toggle thème ☀️/🌙, **wallet** (modale de recharge PayPal, +50 €).

### Onglet Spots (`src/components/LocationsList.tsx`)
Liste triée par distance, pastille + **liseré gauche** couleur catégorie, panneau
« Trophées Disponibles » (cibles fly-to), télémétrie canarienne déco. Filtres par
catégorie : `src/components/QuickFilterBar.tsx`.

### Fiche spot (`src/components/BottomSheet.tsx`)
Bottom sheet : infos, coordonnées, bouton chrono (Missions) ou photo
(Escapades/Plages), partage, itinéraire Google Maps. À la validation : overlay
cinématique **« MISSION RÉUSSIE »**, chime rétro (Web Audio), **SMS** narratif du
perso « Denzel Sag ».

### Onglet Social Club — la JAQUETTE / Cover Quest (`src/components/CoverQuest.tsx`)
Refonte du « Social Club » en **jaquette façon GTA V** :
- Montage inégal (masonry) des **11 cases complétables**, dérivées au runtime
  (`src/coverData.ts`, `COVER_LOCATIONS`). Labels courts éditoriaux (`COVER_LABELS` :
  TEIDE, MASCA, ANAGA, RADAZUL, EL MÉDANO, ABADES, HUMBOLDT, DIEGO H., TERESITAS,
  DUQUE, ENRAMADA).
- **Logo central fixe** « GRAND TENERIFE AUTO / blason **IP** / ISLA PRIMAVERA »
  (overlay décoratif, `.cover-logo`). Footer de progression (`filled / 11`, barre
  `#EA4423→#FF7A4E`).
- États de case : `locked` (loin, dark + scanlines + cadenas + distance) /
  `unlockable` (à portée, pulse + caméra) / `filled` (photo GTA-ifiée + dégradé +
  label + temps).
- **Fond autonome** (`.cq-bg`, fixe) : illustration **Corales** (`corales-bg.webp`)
  nette en haut (~56vh) qui fond vers le noir `#0a0a0b`. La section n'est **PAS**
  theme-aware : **cover sombre identique en dark ET light** (sinon la fresque claire
  bavait en light). Le reste de l'app garde son toggle dark/light.

### Caméra Cover Quest (`src/components/CoverCamera.tsx`)
Overlay plein écran : viseur `getUserMedia` (caméra arrière), réticules d'angle,
scanlines/vignette, **import galerie en secours** (iOS Safari capricieux). Au snap :
filtre catégorie sur `<canvas>` (`contrast/saturate/brightness` + teinte accent en
`overlay` 0.18) → la photo GTA-ifiée passe par les **handlers existants**
(`handleSavePhotoSouvenir` + `handleCompleteLocation`). **Single source of truth :
aucun state dupliqué.**

> **Modèle Cover Quest (réconcilié) :** seules les cases **Escapades/Plages** sont
> déverrouillables à la caméra (**< 500 m**). Les **Missions** se valident par le
> chrono 50 m sur la carte (jamais par la caméra) ; leur case se remplit depuis
> cette complétion (art + temps).

### Notification d'approche
Quand on entre dans la zone d'une case non faite (**100 m** missions / **500 m**
paysages), une **notification** se déclenche : toast in-app + **notification OS**
(`registration.showNotification`, fallback `Notification`), permission demandée à
l'ouverture du Social Club. SW v3 : `notificationclick` refocus l'app.
> ⚠️ **Limite PWA :** pas de géofence en arrière-plan (le watch GPS ne tourne
> qu'app au premier plan, pas de background-geolocation iOS). La notif arrive donc
> app ouverte, pas app fermée. Une vraie push app-fermée imposerait du natif (Capacitor).

## 6. Design system

- **Tokens** : `src/styles/tokens.css` (+ miroir JS `src/styles/tokens.js`) — palette
  Manrique/Vice, variables par catégorie `--cat-*`, surfaces dark+light via
  `[data-theme]`, classe `.app-bg` (scrim + fresque Manrique, utilisée par carte/liste).
- **Couleurs catégories** (source unique : `CATEGORY_MAP[cat].accentColor` dans
  `helper.ts`, propagées partout — pastilles, blips, filtres, BottomSheet, jaquette) :
  QG `#EDEFF2`, Ravitaillement `#46AE3C`, Bars `#E0479B`, Missions `#EA4423`,
  Escapades `#9E7AD2`, Plages `#3F6CC4`, Restaurants `#F0941E`.
- **Polices** : Space Grotesk (display), Inter (body), JetBrains Mono (mono).
- **Thème** : `data-theme="dark|light"` sur `<html>`, toggle dans le HUD, persisté
  (`localStorage` clé `isla_theme`), défaut **dark**. Le Social Club ignore le thème
  (cover sombre fixe) ; tout le reste est theme-aware.

## 7. PWA / offline

- `public/manifest.webmanifest` : name « Grand Tenerife Auto : Isla Primavera »,
  short_name **« GTA IP »**, standalone, portrait, icônes.
- `public/sw.js` (**v3**) : shell network-first, assets stale-while-revalidate,
  tuiles carte cache-first plafonnées (500), splash précaché, `notificationclick`.
  Enregistré **en prod uniquement** (`src/main.tsx`).
- `index.html` : `<title>` = nom complet, `apple-mobile-web-app-title` = « GTA IP »,
  preload du splash, fonts Google, `viewport-fit=cover`.

## 8. Persistance — clés `localStorage`

- `tenirife_completed_locations` — ids complétés (préfixe « tenirife » **historique**,
  ne pas renommer sans migration).
- `tenirife_captured_photos` — photos base64 par id.
- `tenirife_completed_times` — chronos missions par id.
- `isla_theme` — `dark`|`light`.

## 9. Conventions & pièges

- **UI en français.** Tailwind pour le style ; inline réservé aux valeurs dynamiques
  (couleurs catégorie, largeurs de barres).
- Effets Leaflet impératifs via `useRef` → cleanup (remove) dans le `return` des effets.
- Ne **pas** réintroduire de fausses mentions IA (Gemini/Vision/confidence) : aucun LLM.
- Ne **pas** afficher les entrées trophées 101-105 comme spots.
- Ne **pas** rendre le Social Club theme-aware (cover sombre volontaire).
- **Workflow git ⚠️** : le repo est **aussi poussé depuis Google AI Studio**.
  **Toujours `git fetch` + `rebase origin/main` avant de pousser.** Conflits probables
  côté carte (`MapContainer.tsx`, `roadsData.ts`, `index.css`) et `App.tsx`.

## 10. Structure des fichiers

```
index.html, metadata.json, manifest.webmanifest, vite.config.ts, tsconfig.json
public/sw.js, public/assets/{splash.webp, corales-bg.webp, manrique-fields*.svg}
src/
  main.tsx, App.tsx                 ← état global, HUD, onglets, géofence, sons, overlays
  index.css, styles/tokens.css|js
  locationsData.ts, roadsData.ts, types.ts
  coverData.ts                      ← dérivation des 11 cases + labels + rayons
  utils/helper.ts                   ← CATEGORY_MAP, getMarkerHtml, haversineKm, GEOFENCE_KM
  components/
    MapContainer.tsx  LocationsList.tsx  QuickFilterBar.tsx  BottomSheet.tsx
    SplashScreen.tsx  CoverQuest.tsx  CoverCamera.tsx
```

## 11. État & limites connues

- ✅ Lint + build passent. App déployable telle quelle (Vite auto-détecté par Vercel,
  HTTPS requis pour `getUserMedia`/notifications).
- ⏳ À tester sur **vrai téléphone HTTPS** : caméra live + géoloc réelle (le fallback
  galerie et tout le reste sont validés en navigateur).
- 🔕 Notif géofencée **app fermée** = impossible en PWA (cf. §5) → chantier natif.
- 🎨 Cartes de trophées historiquement « dark-glass » ; le Social Club est désormais
  une cover sombre autonome assumée.

---

*Historique détaillé des chantiers de la dernière session : voir
[`SESSION-SUMMARY.md`](SESSION-SUMMARY.md). Guide d'architecture court :
[`CLAUDE.md`](CLAUDE.md).*
