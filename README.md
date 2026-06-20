# Isla de la eterna primavera — Grand Tenerife Auto : Isla Primavera

Compagnon de route interactif pour Tenerife, façon carte-pause de jeu vidéo :
missions de conduite chronométrées, safehouses, ravitaillement, plages et
trophées, le tout sur une carte Leaflet (vue satellite ou plan).

PWA mobile-first : installable, fonctionne hors-ligne (service worker avec mise
en cache des tuiles), progression sauvegardée en `localStorage`.

## Stack

- React 19 + TypeScript, build [Vite](https://vite.dev)
- [Leaflet](https://leafletjs.com) (carte) — tuiles Esri World Imagery (satellite)
  et CARTO Voyager (plan)
- [Tailwind CSS v4](https://tailwindcss.com) (plugin Vite)
- [motion](https://motion.dev) (animations), [lucide-react](https://lucide.dev) (icônes)

## Lancer en local

**Prérequis :** Node.js 18+

```bash
npm install
npm run dev      # serveur de dev sur http://localhost:3000
```

## Scripts

| Script            | Rôle                                  |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Serveur de développement (port 3000)  |
| `npm run build`   | Build de production dans `dist/`      |
| `npm run preview` | Sert le build de production           |
| `npm run lint`    | Vérification de types (`tsc --noEmit`)|

## Notes

- Aucune clé API n'est nécessaire : la « co-validation photo IA » est une
  simulation locale (aucun appel réseau).
- La géolocalisation (géofencing 50 m pour valider missions et photos) requiert
  un contexte sécurisé (HTTPS ou `localhost`).
- Le projet est aussi édité depuis Google AI Studio, qui pousse directement sur
  `main` — faire `git fetch`/rebase avant de pousser.
