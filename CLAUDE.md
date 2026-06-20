# CLAUDE.md

Guide pour travailler sur ce dépôt. Lis-le avant de modifier le code.

## Le projet

**Isla de la eterna primavera** (titre HTML : « G-Drive Companion — Tenerife ») :
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
  `getMarkerHtml` (HTML des « blips » de la carte).
- `src/types.ts` — types (`Category`, `LocationItem`).
- `public/sw.js` — service worker (offline : shell network-first, assets
  stale-while-revalidate, tuiles cache-first plafonnées). Enregistré **en prod
  uniquement** (`src/main.tsx`).

## Modèle de données — important

`INITIAL_LOCATIONS` contient **25 entrées** = **20 spots physiques** (id 1-20)
+ **5 entrées trophées** (id 101-105, catégorie commençant par `🏆`).

- Les entrées trophées **dupliquent les coordonnées** d'un spot physique et ne
  servent **que de cibles « fly-to »** pour le panneau « Trophées Disponibles ».
  Elles sont **exclues** des marqueurs carte et des cartes de liste (filtre
  `!category.startsWith('🏆')`). Ne pas les réintroduire comme spots affichés.
- Seules les catégories **Missions / Escapades / Plages** sont **complétables**
  (chrono géofencé pour Missions ; co-validation photo pour Escapades/Plages) →
  **11 spots complétables**. Le `% complétion` se calcule sur ce sous-ensemble,
  pas sur les 25 entrées.

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
- Clés `localStorage` : `tenirife_completed_locations`, `tenirife_captured_photos`,
  `tenirife_completed_times` (préfixe « tenirife » — historique, ne pas renommer
  sans migration).
