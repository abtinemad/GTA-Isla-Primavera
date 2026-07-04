# TEST-CC — Check-list de validation

> Date : 2026-06-21 (soir)  
> Contexte : test complet en lecture seule après une soirée de correctifs rapides.  
> Commit HEAD : `c1d7cfd` (`feat(jaquette): barres intérieures redimensionnables`).

## 1. Pipeline automatique

| Commande | Résultat | Commentaire |
|----------|----------|-------------|
| `npm run lint` (`tsc --noEmit`) | ✅ OK | Aucune erreur TypeScript. |
| `npm run test` (vitest) | ✅ OK | **26/26 tests passent** (hausse par rapport aux 18/18 du plan précédent). |
| `npm run build` (vite build) | ✅ OK | Build réussi en ~4.6 s. |

### Taille du build
- **Dist : ~46 Mo**.
- Cause identifiée : `src/components/PosterPreview.tsx` charge en eager `../preview-photos*` et `../preview-photos-gta*` via `import.meta.glob(..., { eager: true })`.
- Ces dossiers sont ignorés par `.gitignore` mais **présents dans le working tree**, donc Vite les inclut dans le build production.
- Impact : temps de déploiement Vercel allongé, consommation data mobile utilisateur, risque de dépassement de quota.

## 2. Revue par flux

### 2.1 Carte & marqueurs (`MapContainer.tsx`)
- Initialisation Leaflet propre avec `zoomControl: false` et contrôles custom.
- Deux fonds de carte (satellite Esri + plan CARTO) switchables.
- Position utilisateur : marker pulse animé, `zIndexOffset: 1000`.
- Marqueurs de spots recréés sur changement de filtre/proximité avec `try/catch` par pin (anti white-screen).
- Pulse de proximité appliqué par toggle de classe (`pin-pulse` / `pin-pulse-strong`) sans recréer les icônes.
- Tooltips permanents activés uniquement quand un seul groupe est actif (`singleGroupActive`) → évite le chevauchement.
- Routes de courses affichées seulement quand le filtre Courses est isolé ou une course sélectionnée.
- Courses : mécanisme "proximité > filtre" reproduit pour les départs de course.

**Points de vigilance**
- Aucun `aria-label` sur les pins.
- `try/catch` logge en `console.error` en production.
- Le rebuild complet des marqueurs à chaque changement de `nearbyKey` peut être coûteux sur mobile avec beaucoup de spots.

### 2.2 Fiche spot/course (`BottomSheet.tsx`)
- Course : deep-links Google Maps / Waze / Plans vers le départ, chrono indicatif, trophée.
- Spot :
  - Validation photo pour `isPhotoSlot(location.category)` (Escapades **et** Plages) — co-validation GPS < 500 m.
  - Mission chrono entièrement manuel avec `pendingTime` + validation photo.
  - Photo "ambiance" libre sur `Ravitaillement`, `Beach Club`, `Restaurants`, `Bars`.
  - Liens externes (site/Instagram/TikTok) avec marquage `visitedSpotIds`.
- Compression client à 1280 px, JPEG 0.85.

**Points de vigilance**
- Classes Tailwind non standard (`bg-zinc-250`, `text-zinc-550`, etc.) — fonctionnent par JIT mais non documentées.
- Timeouts décoratifs dans `startVerificationFlow` : nettoyés via `verifyTokenRef` mais pas de `clearTimeout` physique.
- L'analyse "IA" est purement cosmétique (pas de vrai modèle) — acceptable pour le gameplay.

### 2.3 État global (`App.tsx`)
- Hydratation IndexedDB des 5 stores photos au montage.
- File GTA séquentielle avec `gtaQueueRef`, `gtaRunningRef`, `gtaInflightRef`, `gtaDoneRef`.
- Auto-enqueue des originaux manquant de version GTA.
- Reprise de la file sur `online`.
- Géofence : validation missions 50 m, courses 50 m, notifications approche, prompts photo course.
- `watchPosition` gate après premier geste utilisateur (`interacted`) pour fiabilité iOS.
- `elapsedTimeRef` utilisé pour éviter les re-subscriptions à chaque tick du chrono.
- `ensurePersistentStorage()` + bandeau discret pour la persistance iOS/Safari.

**Corrections vérifiées ce soir**
- `ambientFiredRef` n'est posé qu'après le guard `activeRunLocationId !== null` et après le cooldown (lignes 373-388).
- `Map` importé comme `MapIcon` pour éviter le conflit avec le global Leaflet.
- Plages validables comme les Escapades via `isPhotoSlot`.

### 2.4 Service Worker (`public/sw.js`)
- Cache shell network-first (`/`, `/index.html`, `/assets/splash.webp`).
- Assets stale-while-revalidate.
- Tuiles cache-first plafonnées à 500.
- `notificationclick` focus.

**Point de vigilance**
- Aucune logique côté client pour proposer la mise à jour lors d'un changement de version du SW.

### 2.5 Proxy GTA (`api/gtaify.ts`)
- Clé API côté serveur (`GTA_API_KEY`).
- Fallback sur deux modèles.
- `maxDuration: 60`.

**Risque de sécurité**
- Aucun rate-limit.
- Aucune validation de taille d'image.
- Aucune validation de type MIME.
- Aucune authentification utilisateur.
- Risque : facturation API excessive, déni de service.

## 3. Synthèse des bugs restants

| # | Gravité | Sujet | Fichier concerné |
|---|---------|-------|------------------|
| 1 | 🔴 Critique | Build de 46 Mo (photos dev-only embarquées) | `PosterPreview.tsx`, `src/preview-photos*` |
| 2 | 🔴 Critique | Proxy `/api/gtaify` ouvert | `api/gtaify.ts` |
| 3 | 🟠 Important | Aucun backup/export des photos | `storage.ts` |
| 4 | 🟠 Important | Pas de mise à jour SW côté client | `public/sw.js` / `App.tsx` |
| 5 | 🟠 Important | Classes Tailwind inconnues | `BottomSheet.tsx`, etc. |
| 6 | 🟠 Important | Thème non changeable depuis l'UI | `App.tsx` |
| 7 | 🟠 Important | Timeouts non nettoyés physiquement | `BottomSheet.tsx`, `CoverQuest.tsx`, `PosterComposer.tsx` |
| 8 | 🟠 Important | Splash non passable | `SplashScreen.tsx` |
| 9 | 🟡 Mineur | Import `React` inutile | `BottomSheet.tsx` |
| 10 | 🟡 Mineur | Pins sans `aria-label` | `MapContainer.tsx` |

## 4. Verdict

- ✅ Code TypeScript propre (lint OK).
- ✅ Tests unitaires passent (26/26).
- ✅ Build fonctionnel.
- ⚠️ Build trop lourd à cause d'assets dev-only.
- ⚠️ Sécurité du proxy GTA à renforcer impérativement avant mise en production publique.
- ✅ Flux principaux (carte, fiche, chrono, photo, GTA, persist iOS) corrigés et cohérents ce soir.
