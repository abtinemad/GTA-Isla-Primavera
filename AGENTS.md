# AGENTS.md — Guide pour les agents de codage

> Ce fichier est destiné aux assistants IA travaillant sur le dépôt. Il résume l’architecture, les conventions et les pièges courants. Le lecteur est supposé ne rien connaître du projet.
> Les documents complémentaires existants (`CLAUDE.md`, `APP-OVERVIEW.md`, `SESSION-SUMMARY.md`) contiennent des informations partiellement obsolètes ; la source de vérité est le code source lui-même et le présent fichier.

---

## 1. Vue d’ensemble du projet

**Nom du projet** : `isla-de-la-eterna-primavera` (package) / **Grand Tenerife Auto : Isla Primavera** (titre utilisateur).

C’est une **PWA mobile-first** : un compagnon de route interactif pour **Tenerife**, présenté comme une carte-pause de jeu vidéo façon GTA. L’application affiche une carte Leaflet, des missions de conduite chronométrées, des spots (QG, ravitaillement, bars, restaurants, plages, beach clubs, escapades), des courses routières et un « Social Club » servant de galerie photo / jaquette.

Points clés :

- **Pas de backend applicatif** : la progression et les photos tournent côté client.
- **Un seul endpoint serverless** : `/api/gtaify` (Vercel) sert de proxy pour styliser les photos à la façon GTA via l’API image de Google. La clé API reste côté serveur.
- **Progression persistée** en `localStorage` + **photos en IndexedDB** (les base64 lourds ne passent pas dans le quota localStorage).
- **PWA installable**, fonctionne hors ligne grâce à un service worker personnalisé (`public/sw.js`).
- **UI en français**.

---

## 2. Stack technique

| Domaine | Choix |
|---------|-------|
| Langage | TypeScript 5.8 |
| Framework UI | React 19 (mode strict) |
| Build tool | Vite 6 |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` |
| Animation | `motion` (`motion/react`) |
| Icônes | `lucide-react` |
| Carte | Leaflet 1.9 (utilisé de manière impérative via refs) |
| Tuiles cartes | Esri World Imagery (satellite) + CARTO Voyager (plan) |
| Tests | Vitest 4, environnement Node, fichiers `src/**/*.test.ts` |
| Runtime serverless | Vercel Function Node.js (`api/gtaify.ts`) |
| Polices | Space Grotesk, Inter, JetBrains Mono, Oswald, Barlow Semi Condensed (Google Fonts) |

### Fichiers de configuration principaux

- `package.json` — scripts et dépendances.
- `vite.config.ts` — plugins React + Tailwind, alias `@/` vers la racine, `manualChunks` pour Leaflet / Motion / React.
- `tsconfig.json` — `ES2022`, `moduleResolution: bundler`, alias `@/*`, `noEmit`.
- `vitest.config.ts` — tests Node, inclusion `src/**/*.test.ts`.
- `index.html` — point d’entrée, PWA, preload du splash, polices.
- `public/manifest.webmanifest` — identité PWA.
- `public/sw.js` — service worker (offline, cache tuiles, notifications).
- `metadata.json` — métadonnées pour l’hébergement (AI Studio).

---

## 3. Structure des fichiers

```
.
├── api/gtaify.ts                    # Proxy Vercel : stylisation GTA des photos
├── scripts/gtaify-preview.mjs       # Script dev-only pour GTA-ifier src/preview-photos/
├── public/
│   ├── sw.js                        # Service worker v7
│   ├── manifest.webmanifest
│   ├── assets/splash.webp           # Écran de boot
│   ├── assets/corales-bg.webp       # Fond Social Club
│   ├── assets/manrique-fields*.svg  # Fonds thème dark/light
│   └── icons/                       # Icônes PWA
├── src/
│   ├── main.tsx                     # Montage React + enregistrement SW (prod only)
│   ├── App.tsx                      # État global, onglets, géofence, chrono, sons, queue GTA
│   ├── index.css                    # Import Tailwind + overrides Leaflet + animations
│   ├── types.ts                     # Category, LocationItem, FilterOption, MissionType
│   ├── locationsData.ts             # INITIAL_LOCATIONS : 27 spots + 5 trophées fly-to
│   ├── coverData.ts                 # Dérivation des slots complétables, labels, rayons
│   ├── filterGroups.ts              # Source unique des filtres carte/liste
│   ├── data/
│   │   ├── coursesData.ts           # 8 courses (RUN 0 prologue + 7 courses réelles)
│   │   ├── denzelMessages.ts        # Voix d’El Jefe + tutoriel
│   │   ├── islaPhrases.ts           # Aphorismes carte
│   │   └── panelImages.ts           # Illustrations messages/tutoriel
│   ├── components/
│   │   ├── MapContainer.tsx         # Carte Leaflet, pins, routes courses, HUD carte
│   │   ├── LocationsList.tsx        # Liste des spots + trophées fly-to
│   │   ├── MapFilterBar.tsx         # Filtres flottants sur la carte
│   │   ├── QuickFilterBar.tsx       # Filtres dans la vue liste
│   │   ├── BottomSheet.tsx          # Fiche spot / course
│   │   ├── CoverQuest.tsx           # Social Club / galerie / jaquette
│   │   ├── PosterComposer.tsx       # Éditeur de jaquette 9 cases + export
│   │   ├── PosterPreview.tsx        # Aperçu dev-only (?poster=1)
│   │   ├── CoursePhotoPrompt.tsx    # Bulle de capture photo au point course
│   │   ├── DenzelMessage.tsx        # Bandeau narration El Jefe
│   │   ├── TutorialOverlay.tsx      # Onboarding guidé
│   │   ├── SplashScreen.tsx         # Écran de démarrage
│   │   └── SplashSpinner.tsx        # Loader réutilisable
│   ├── utils/
│   │   ├── helper.ts                # haversine, CATEGORY_MAP, marqueurs carte
│   │   ├── storage.ts               # localStorage migration + IndexedDB photos + poster
│   │   ├── imageCompress.ts         # Compression JPEG côté client
│   │   ├── photoCollection.ts       # Merge/dédupl des 4 sources photo
│   │   ├── posterGeometry.ts        # Géométrie pure de la jaquette (testable)
│   │   ├── posterGeometry.test.ts   # Tests Vitest de la géométrie
│   │   └── posterComposition.test.ts# Tests Vitest de la persistence poster
│   ├── styles/
│   │   ├── tokens.css               # Variables design Manrique/Vice dark+light
│   │   └── tokens.js                # Miroir JS des tokens
│   ├── assets/                      # Logos et panneaux locaux
│   ├── preview-photos/              # Photos locales dev-only
│   └── preview-photos-gta/          # Versions GTA-ifiées dev-only
```

---

## 4. Commandes de build, test et développement

Toutes les commandes utilisent `npm`.

| Commande | Rôle |
|----------|------|
| `npm install` | Installation des dépendances |
| `npm run dev` | Serveur de développement Vite sur `http://localhost:3000` |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Sert le build de production localement |
| `npm run lint` | Vérification de types TypeScript (`tsc --noEmit`) |
| `npm run test` | Lance les tests Vitest (`vitest run`) |
| `npm run clean` | Supprime `dist/` |

### Workflow de validation obligatoire

Après **toute** modification :

```bash
npm run lint
npm run build
npm run test
```

Le lint seul (`tsc --noEmit`) ne détecte pas toutes les erreurs JSX ; le build est nécessaire. Les tests couvrent la géométrie de la jaquette et la rétro-compatibilité de la composition poster.

---

## 5. Architecture et organisation du code

### 5.1 État global

L’état global vit dans **`src/App.tsx`** (pas de librairie d’état externe). Les principaux états :

- `activeGroups` : groupes de filtres actifs (multi-select).
- `selectedLocation` / `selectedCourse` : fiche ouverte (mutuellement exclusifs).
- `userCoords` : position GPS live.
- `completedLocationIds` : ids des spots complétés (Missions/Escapades/Plages).
- `completedTimes` : chronos des missions.
- `completedCourseIds` : ids des courses validées (run terminé à l’arrivée).
- Photos : `coursePhotos`, `capturedPhotos`, `spotPhotos`, `freePhotos` (toutes hydratées depuis IndexedDB au montage).
- `gtaPhotos` / `gtaStatus` : versions stylisées GTA + état de la file d’attente.
- `theme` : `dark` ou `light`, persisté dans `isla_theme`.
- `showTutorial` : onboarding affiché une fois.

### 5.2 Navigation

Pas de routeur. Trois onglets gérés par un state `activeTab` : `map`, `list`, `trophies`.

- **Carte** (`MapContainer`) : vue principale avec filtres flottants.
- **Liste** (`LocationsList`) : slide-over mobile / sidebar desktop.
- **Trophées** (`CoverQuest`) : Social Club avec galerie et compositeur de jaquette.

### 5.3 Sources de vérité importantes

- **`src/locationsData.ts` → `INITIAL_LOCATIONS`** : source unique des spots.
- **`src/data/coursesData.ts` → `courses`** : source unique des courses.
- **`src/utils/helper.ts` → `CATEGORY_MAP`** : couleurs, classes et icônes de toutes les catégories.
- **`src/filterGroups.ts` → `FILTER_GROUPS`** : filtres carte/liste dérivés de `CATEGORY_MAP`.
- **`src/coverData.ts` → `COVER_LABELS`, `COVER_LOCATIONS`, `isPhotoSlot`, `approachRadiusKm`** : logique de la jaquette.

---

## 6. Modèle de données

### 6.1 Spots (`INITIAL_LOCATIONS`)

- **32 entrées** au total :
  - **27 spots physiques** (ids 1–27, avec les ids 10 et 11 historiquement absents).
  - **5 entrées trophées** (ids 101–105, catégories commençant par `🏆`).
- Les entrées trophées **dupliquent les coordonnées** d’un spot physique et ne servent que de cibles « fly-to » dans le panneau « Trophées Disponibles ». Elles sont **exclues** des marqueurs carte et de la liste : filtre `!category.startsWith('🏆')`.
- Les spots de catégorie `Missions` sont également exclus de la carte/liste car ils sont représentés par la couche **courses** (voir `coursesData.ts`).

### 6.2 Catégories

| Catégorie | Complétable ? | Mécanisme |
|-----------|---------------|-----------|
| `QG` | Non | Spawn / safehouse |
| `Ravitaillement` | Non | Point de drop |
| `Bars` | Non | Ambiance libre |
| `Restaurants` | Non | Ambiance libre |
| `Beach Club` | Non | Ambiance libre |
| `Missions` | Oui | Chrono géofencé 50 m |
| `Escapades` | Oui | Photo à < 500 m |
| `Plages` | Oui | Photo à < 500 m |

Les catégories complétables sont définies dans `src/coverData.ts` (`COMPLETABLE_CATEGORIES`).

### 6.3 Courses (`coursesData.ts`)

8 courses avec tracés routiers réels simplifiés :

- `run-0-prologue` : tutoriel, **exclu** des compteurs.
- 7 courses réelles (RUN 1 à Volcan Option B) avec départ, arrivée, distance, chrono indicatif.
- Chaque course a un point photo (arrivée par défaut, départ si `photoAtStart: true`).

---

## 7. Persistance

### 7.1 `localStorage`

Clés utilisées (préfixe actuel **`tenerife_`** ) :

- `tenerife_completed_locations` — ids complétés.
- `tenerife_completed_times` — chronos missions.
- `tenerife_completed_courses` — ids courses validées.
- `tenerife_denzel_ambient_ts` — dernier message ambiant d’El Jefe (cooldown 30 min).
- `isla_theme` — `dark` ou `light`.
- `dev` — flag dev mode (`?dev=1`).
- `tutorialSeen` — tutoriel déjà vu.

### 7.2 Migration historique

Ancien préfixe mal orthographié `tenirife_`. `migrateLegacyKeys()` dans `src/utils/storage.ts` renomme une fois les clés au démarrage. **Ne pas renommer ces clés sans migration.**

### 7.3 IndexedDB

Base `tenerife`, version 5. Stores :

- `course_photos` — photos de course (clé = id course).
- `spot_photos` — photos ambiance sur spots (clé = id spot).
- `captured_photos` — photos d’Escapades (co-validation, clé = id spot).
- `free_photos` — photos perso libres (clé = uuid).
- `gta_photos` — versions stylisées GTA (clé composite : `course:<id>`, `loc:<id>`, `free:<id>`).
- `poster` — composition de la jaquette (slots + logo + gutter).

Les stores sont créés additivement dans `onupgradeneeded` ; jamais de `deleteObjectStore`.

---

## 8. Géofencing et validation

La validation repose sur `navigator.geolocation.watchPosition` et la distance haversine (`haversineKm` dans `helper.ts`).

### 8.1 Rayons

| Mécanisme | Rayon | Défini dans |
|-----------|-------|-------------|
| Arrivée chrono mission/course | 50 m | constante `0.050` dans `App.tsx` / `GEOFENCE_KM` dans `helper.ts` |
| Photo Escapades / Plages | 500 m | `PHOTO_UNLOCK_KM` dans `coverData.ts` ; `PHOTO_VALIDATION_RADIUS_KM` dans `BottomSheet.tsx` |
| Notification approche missions | 100 m | `MISSION_APPROACH_KM` dans `coverData.ts` |
| Notification approche photos | 500 m | `PHOTO_UNLOCK_KM` dans `coverData.ts` |
| Photo point course | 50 m | constante `0.050` dans `App.tsx` |

### 8.2 Flux

1. **Missions** : l’utilisateur lance le chrono depuis la fiche course. Quand il entre dans le rayon 50 m de l’arrivée, le chrono s’arrête, la course est marquée comme run done.
2. **Escapades / Plages** : à < 500 m, la fiche permet de prendre/charger une photo. La validation appelle `handleCompleteLocation` + `handleSavePhotoSouvenir`.
3. **Course photo prompt** : à < 50 m du point photo d’une course, une bulle `CoursePhotoPrompt` invite à capturer la photo (indépendante de la validation du run).
4. **Notifications d’approche** : toast in-app + notification OS si permission accordée. Limitation PWA : le watch GPS ne tourne qu’au premier plan.

### 8.3 Mode développeur

Ajouter `?dev=1` à l’URL pour activer un simulateur de géofence (boutons visibles en bas à gauche). Le simulateur appelle le vrai `applyGeofence` aux coordonnées cibles.

---

## 9. Pipeline photo et stylisation GTA

### 9.1 Capture

- Compression côté client : max 1280 px, JPEG qualité 0.85 (`imageCompress.ts`).
- Aucune colorimétrie locale : l’original est conservé tel quel.

### 9.2 File de stylisation GTA

`App.tsx` gère une file d’attente séquentielle :

1. À chaque nouvelle photo originale, `enqueueGta()` l’ajoute à `gtaQueueRef`.
2. `postGtaify()` envoie un POST à `/api/gtaify` avec l’image base64.
3. La réponse stylisée est stockée dans IndexedDB (`gtaPhotos`) ; l’affichage préfère la version GTA.
4. La file est pause en offline et reprise sur l’événement `online`.

### 9.3 Proxy `/api/gtaify`

- Vercel Function Node.js (`api/gtaify.ts`).
- Variable d’environnement **`GTA_API_KEY`** obligatoire (clé Google Generative Language).
- Variable optionnelle `GTA_PROMPT` pour surcharger le prompt.
- Modèles essayés : `gemini-3.1-flash-image` puis `gemini-3.1-flash-image-preview`.
- `maxDuration: 60`.
- En cas d’erreur, l’application garde l’original ; un bouton « régénérer » relance le traitement.

### 9.4 Photos perso

Ajoutées librement depuis le Social Club (`CoverQuest`). Clés uuid, supprimables (original + GTA). Non décomptées dans les compteurs.

---

## 10. PWA et offline

### 10.1 Manifeste

`public/manifest.webmanifest` :

- `name` : « Grand Tenerife Auto : Isla Primavera »
- `short_name` : « GTA IP »
- `display` : `standalone`, orientation `portrait-primary`.
- Icônes maskables et non maskables.

### 10.2 Service Worker (`public/sw.js` v7)

- **Shell** : network-first pour les navigations, fallback `index.html` offline.
- **Assets statiques** : stale-while-revalidate.
- **Tuiles cartes** (Esri / CARTO) : cache-first, plafonné à 500 tuiles.
- **Splash** : précaché (`/assets/splash.webp`).
- **Notifications** : `notificationclick` refocus l’application.

Le SW n’est enregistré qu’en production (`import.meta.env.PROD`) dans `main.tsx`.

---

## 11. Design system et conventions de style

### 11.1 Tokens

`src/styles/tokens.css` définit les variables CSS ; `src/styles/tokens.js` en est le miroir JS.

- Palette principale : `--isla-primary` `#EA4423`, `--isla-cash` `#46AE3C`.
- Couleurs catégories : `--cat-qg`, `--cat-ravito`, `--cat-bars`, `--cat-missions`, `--cat-escapades`, `--cat-plages`, `--cat-restaurants`, `--cat-beachclub`.
- Thèmes dark/light via `data-theme="dark|light"` sur `<html>`.
- Classe `.app-bg` : fond Manrique + scrim, thématisé.

### 11.2 Marqueurs carte

Tous les marqueurs sont des « gouttes à l’envers » (teardrop) générés dans `helper.ts` :

- `categoryToVariant()` mappe une catégorie vers un variant.
- `buildMarkerHtml()` construit le SVG final.
- `categoryIconSvg()` réutilise le glyphe du marqueur pour les filtres et la liste.

Aucune liste d’icônes parallèle : tout dérive de `CATEGORY_MAP`.

### 11.3 Conventions CSS

- Tailwind pour le style statique.
- Styles inline réservés aux valeurs dynamiques (couleurs de catégorie, largeurs de barres, positions).
- Les overrides Leaflet vivent dans `src/index.css`.

### 11.4 Thème

Défaut `dark`. Toggle dans le HUD de la carte. Le Social Club / Cover Quest est **theme-aware** (contrairement à certaines versions antérieures).

---

## 12. Tests

### 12.1 Configuration

`vitest.config.ts` :

- Environnement Node.
- Inclusion : `src/**/*.test.ts`.
- Pas de DOM ni de plugins Vite React dans la config de test.

### 12.2 Fichiers de test existants

- `src/utils/posterGeometry.test.ts` — 11 tests : validité des 9 cases de la mosaïque, pavage exact, placement photo (jamais de vide), filets.
- `src/utils/posterComposition.test.ts` — 7 tests : round-trip, rétro-compatibilité des formats de composition poster.

### 12.3 Ajouter des tests

Pour les modules purs sans DOM/CSS (helpers, géométrie, parsing), créer un fichier `.test.ts` dans `src/`. Les tests React nécessiteraient d’ajuster la config Vitest (`environment: 'jsdom'`, plugin React) ; ce n’est pas le cas actuellement.

---

## 13. Déploiement

### 13.1 Vercel (déploiement principal)

Le projet est détecté automatiquement comme application Vite par Vercel.

Points de vigilance :

- Définir la variable d’environnement **`GTA_API_KEY`** dans Vercel pour activer la stylisation GTA.
- La route `/api/gtaify` est servie par la fonction dans `api/gtaify.ts`.
- HTTPS requis pour `getUserMedia`, géolocalisation et notifications.

### 13.2 AI Studio

Le projet est également édité depuis Google AI Studio, qui injecte `APP_URL` via `.env`. Voir `.env.example`.

### 13.3 Build de production

```bash
npm run build
```

Sortie dans `dist/`. `npm run preview` permet de tester le build localement, y compris l’enregistrement du service worker.

---

## 14. Considérations de sécurité

- **Clé API** : `GTA_API_KEY` ne transite **jamais** dans le client ; elle reste dans les variables d’environnement Vercel.
- **Photos** : les photos originales restent dans le navigateur de l’utilisateur (IndexedDB). Seule la version compressée (1280 px) est envoyée au proxy.
- **Geolocation** : nécessite un contexte sécurisé (HTTPS ou `localhost`).
- **Notifications** : permission demandée suite à un geste utilisateur (ouverture du Social Club).
- **Prompt** : le prompt GTA est paramétrable côté serveur (`GTA_PROMPT`) pour éviter de modifier le code si un ajustement est nécessaire.

---

## 15. Conventions de développement et pièges

### 15.1 Langue

- Interface et textes utilisateur en **français**.
- Commentaires et documentation en français dans le code.

### 15.2 Hooks React

- Ne **jamais** conditionner l’ordre des hooks (pas de `return` avant un hook).
- Les effets Leaflet impératifs utilisent `useRef` et **doivent faire le cleanup** (remove marker/layer/listener) dans le `return` du `useEffect`.

### 15.3 Sources de vérité

- Ne pas créer de listes d’icônes/couleurs parallèles à `CATEGORY_MAP`.
- Ne pas afficher les entrées trophées (ids 101–105) comme des spots.
- Les courses ont leur propre dataset (`coursesData.ts`) ; ne pas les confondre avec les spots `Missions`.

### 15.4 Photos

- Ne jamais stocker de base64 lourd en `localStorage`. Utiliser IndexedDB (`utils/storage.ts`).
- L’original n’est jamais écrasé par la version GTA ; elles coexistent (`gtaPhotos` vs stores originaux).

### 15.5 Géofence

- Ne pas introduire de second système de géofence. Toute la logique passe par `applyGeofence` dans `App.tsx`.
- Les missions se valident par le **chrono 50 m**, jamais par la caméra.
- Les photos Escapades/Plages utilisent un rayon **500 m** (paysages cadrés de loin).

### 15.6 IA / LLM

Aucun appel LLM n’est fait côté client. La console « IA » dans `BottomSheet.tsx` est purement décorative. Ne pas réintroduire de fausses mentions Gemini / Vision / confidence.

### 15.7 Documentation obsolète

`CLAUDE.md`, `APP-OVERVIEW.md` et `SESSION-SUMMARY.md` décrivent des versions antérieures du projet (nombre de spots, présence d’un `CoverCamera.tsx`, clés `tenirife_` non migrées, etc.). En cas de contradiction, faire confiance au code source et au présent `AGENTS.md`.

---

## 16. Workflow git — ⚠️ pushes externes

Le dépôt `abtinemad/Isla-de-la-eterna-primavera` reçoit des commits depuis **Google AI Studio**, qui pousse directement sur `main`.

Avant chaque push local :

```bash
git fetch origin
git rebase origin/main
```

Les conflits sont probables dans `App.tsx`, `MapContainer.tsx`, `BottomSheet.tsx` et les fichiers de données.

**Ne jamais** exécuter `git push --force` sans confirmation explicite de l’utilisateur.

---

## 17. Résumé des commandes essentielles

```bash
# Installation
npm install

# Développement
npm run dev          # http://localhost:3000

# Validation avant commit
npm run lint
npm run build
npm run test

# Production locale
npm run build
npm run preview
```
