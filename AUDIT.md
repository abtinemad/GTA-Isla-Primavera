# AUDIT — Grand Tenerife Auto : Isla Primavera

> Audit complet en lecture seule du repo. Aucun fichier source n'a été modifié. Seul ce `AUDIT.md` a été créé et n'est pas pushé.
> Date de l'audit : 2026-06-22.

## Résumé exécutif

L'application est globalement **solide** : architecture claire, source unique des catégories/icônes, pipeline photo/GTA bien pensé, tests de géométrie de la jaquette robustes, build TypeScript propre. Cependant, plusieurs points **critiques** doivent être corrigés avant un usage serein sur le terrain, en particulier sur iPhone :

1. **Build de production de 46 Mo** à cause de photos `src/preview-photos*` embarquées par erreur.
2. **IndexedDB non persistante sur iOS** : risque réel de perte des photos après ~7 jours d'inactivité.
3. **Proxy `/api/gtaify` totalement ouvert** : pas de rate-limit, pas d'authentification, pas de validation de taille.
4. **Aucun backup/export** des photos : perte de téléphone = perte des souvenirs.

---

## Méthodologie

- `git status` et `git log` pour l'état du repo.
- `npm run lint` (`tsc --noEmit`) : ✅ OK.
- `npm run test` (`vitest run`) : ✅ OK, 18/18 tests.
- `npm run build` : ✅ réussit, mais révèle un emballage de 46 Mo de photos dev-only.
- Lecture manuelle des fichiers clés : `App.tsx`, `MapContainer.tsx`, `BottomSheet.tsx`, `CoverQuest.tsx`, `PosterComposer.tsx`, `storage.ts`, `helper.ts`, `sw.js`, `api/gtaify.ts`, etc.
- Recherches ciblées : `navigator.storage.persist`, `process.env`, imports inutilisés, assets orphelins.

---

## 1. Santé build

| Fichier / commande | Statut | Problème |
|---|---|---|
| `npm run lint` | ✅ OK | Aucune erreur TypeScript. |
| `npm run test` | ✅ OK | 18/18 tests passent. |
| `npm run build` | ✅ OK | Build réussit. |
| `tsconfig.json` | ⚠️ **Important** | `strict` n'est pas activé. `noImplicitAny`, `strictNullChecks`, etc. sont désactivés par défaut. |

**Constat détaillé** : le build passe grâce à la configuration actuelle, mais celle-ci est indulgente. L'absence de `strict` masque des risques de `null`/`undefined` non gérés, notamment dans les accès à `localStorage`, `indexedDB`, et les refs React.

**Correctif suggéré** :
```json
"compilerOptions": {
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```
Puis corriger les erreurs remontées. Cela prendra probablement quelques heures mais évitera des bugs en production.

---

## 2. PWA / Offline

| Sujet | Statut | Problème |
|---|---|---|
| Service Worker `public/sw.js` | ✅ OK | Versioning `v7`, `skipWaiting()`, `clients.claim()`, nettoyage des anciens caches. |
| Cache tuiles | ✅ OK | Cache-first, plafonné à 500 tuiles avec `trimCache`. |
| Shell précaché | ⚠️ **Important** | Seuls `/`, `/index.html`, `/assets/splash.webp` sont précachés. Les polices Google Fonts, les icônes PWA et le logo ne le sont pas. |
| Mise à jour du SW | ⚠️ **Important** | Aucun code client n'écoute `updatefound` / `controllerchange` pour forcer un rechargement. |
| Offline API | ✅ OK | Requêtes POST ignorées par le SW ; file GTA mise en pause sur `navigator.onLine === false`. |

**Constat détaillé** :
- Le SW est bien conçu mais le précaching est trop minimal. Sur une première ouverture en mode avion, les textes peuvent s'afficher avec une police fallback, et les icônes du manifeste peuvent manquer.
- Sans listener de mise à jour côté client, un utilisateur qui garde l'app ouverte peut rester bloqué sur une vieille version après un déploiement. C'est un classique piège PWA.

**Correctifs suggérés** :
1. Ajouter les polices et icônes essentielles dans `event.waitUntil(cache.addAll([...]))`.
2. Dans `src/main.tsx`, après `navigator.serviceWorker.register('/sw.js')`, ajouter :
```ts
reg.onupdatefound = () => {
  const newWorker = reg.installing;
  newWorker?.addEventListener('statechange', () => {
    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
      // nouvelle version disponible
      if (confirm('Une nouvelle version est disponible. Recharger ?')) {
        window.location.reload();
      }
    }
  });
};
```

---

## 3. iOS Safari spécifique

| Sujet | Statut | Problème |
|---|---|---|
| Capture caméra | ✅ OK | `capture="environment"` utilisé partout. |
| Web Share → Photos | ✅ OK | `navigator.share({ files })` + fallback download dans `CoverQuest.tsx` et `PosterComposer.tsx`. |
| Permissions géoloc | ⚠️ Important | Pas de message explicite si l'utilisateur refuse la géoloc. |
| Persistance IndexedDB | 🔴 **CRITIQUE** | `navigator.storage.persist()` n'est jamais appelé. |
| Gestion erreurs IndexedDB | ⚠️ Important | Erreurs silencieusement ignorées. |

**Constat détaillé** : Sur iOS, Safari peut purger IndexedDB si l'app n'est pas ouverte pendant ~7 jours, sauf si `navigator.storage.persist()` a été accepté. Les photos prises pendant le séjour à Tenerife sont donc à risque. De plus, si l'utilisateur refuse la géolocalisation, l'app ne lui dit pas comment activer manuellement une mission.

**Correctifs suggérés** :
```ts
// Au montage, après un geste utilisateur
if (navigator.storage && navigator.storage.persist) {
  const persistent = await navigator.storage.persist();
  if (!persistent) {
    // Afficher un bandeau discret : "Activez le stockage persistant pour ne pas perdre vos photos"
  }
}
```
- Ajouter un bandeau d'aide quand `watchPosition` échoue ou qu'aucune position n'est reçue.
- Afficher une alerte explicative si `indexedDB.open` ou une transaction échoue.

---

## 4. Pipeline GTA-ifier

| Sujet | Statut | Problème |
|---|---|---|
| Clé API côté serveur | ✅ OK | `GTA_API_KEY` dans `api/gtaify.ts`, jamais dans le client. |
| Compression avant envoi | ✅ OK | 1280 px / JPEG 0.85 côté client. |
| Pas de retry en boucle | ✅ OK | Une erreur met `gtaStatus[key] = 'error'`. |
| Fallback original | ✅ OK | Affichage préfère GTA sinon original. |
| Proxy ouvert | 🔴 **CRITIQUE** | Pas de rate-limit, auth, validation de taille ni CORS restreint. |
| Reprise offline | ⚠️ Important | Reprise uniquement sur événement `online`, peu fiable. |

**Constat détaillé** : `api/gtaify.ts` accepte n'importe quel POST et transmet directement `req.body.image` à Google. Un bot peut vider le crédit API en quelques minutes.

**Correctifs suggérés** :
1. Rate-limit côté serveur, par IP ou session (ex. max 10 requêtes / minute).
2. Limiter la taille de `req.body.image` (ex. 2 Mo max).
3. Valider que `image` est bien une chaîne base64 JPEG/PNG.
4. Ajouter un retry côté client avec backoff exponentiel (max 3 tentatives) en cas d'erreur réseau.

---

## 5. Données

| Sujet | Statut | Problème |
|---|---|---|
| Original + GTA | ✅ OK | Coexistence dans des stores séparés. |
| Poster composition | ✅ OK | Persistance testée, rétro-compatibilité assurée. |
| Migration localStorage | ✅ OK | `tenirife_*` → `tenerife_*`. |
| IndexedDB additive | ✅ OK | Version 5, création additive. |
| Backup / export | 🔴 **CRITIQUE** | Aucun moyen de sortir les photos de l'appareil. |

**Correctif suggéré** : ajouter un bouton "Exporter ma collection" dans le Social Club qui génère un ZIP (ou plusieurs fichiers partagés via Web Share) contenant les originaux + la version GTA + la composition de la jaquette.

---

## 6. Géoloc / Geofence

| Sujet | Statut | Problème |
|---|---|---|
| Rayons | ✅ OK | 50 m course/mission, 500 m photos. |
| Déclenchement unique | ✅ OK | Fire-once avec ré-armement. |
| Permissions refusées | ⚠️ Important | Pas de feedback utilisateur. |
| Batterie | ⚠️ Confort | `enableHighAccuracy: true` permanent. |

**Correctif suggéré** : afficher un bandeau "GPS indisponible" avec un lien vers les réglages iOS si `watchPosition` échoue. Proposer un bouton "Actualiser ma position" manuel.

---

## 7. Sécurité

| Sujet | Statut | Problème |
|---|---|---|
| Secrets dans le bundle | ✅ OK | Aucun secret dans `src/`. |
| Proxy ouvert | 🔴 **CRITIQUE** | Voir §4. |
| Prompt injection côté serveur | ⚠️ Important | `GTA_PROMPT` injecté tel quel. Restreindre l'accès à l'environnement Vercel. |

---

## 8. Cohérence

| Sujet | Statut | Problème |
|---|---|---|
| Source unique catégories | ✅ OK | `CATEGORY_MAP` partout. |
| Filtres dérivés | ✅ OK | `FILTER_GROUPS` dérive de `CATEGORY_MAP`. |
| Duplication assets | ⚠️ **Important** | Dossier `assets/` à la racine (1,2 Mo) duplique `src/assets/`. |
| Fichier mal placé | ⚠️ **Important** | `src/data/eljefe-avatar.webp` est un doublon non suivi. |
| Noms obsolètes | ✅ OK | Aucun `PATCH-*.md`. Titre cohérent. |

**Correctifs suggérés** : supprimer `assets/` à la racine et `src/data/eljefe-avatar.webp` après vérification.

---

## 9. Code mort / assets orphelins

| Élément | Type | Statut |
|---|---|---|
| `import React` dans `BottomSheet.tsx` et `CoursePhotoPrompt.tsx` | import inutile | ⚠️ Confort |
| `MapPin` importé dans `LocationsList.tsx` | import inutile | ⚠️ Confort |
| `FilterOption` dans `src/types.ts` | type non utilisé | ⚠️ Confort |
| Dossier `assets/` à la racine | assets orphelins | ⚠️ Important |
| `src/data/eljefe-avatar.webp` | asset orphelin | ⚠️ Important |
| Classes Tailwind inconnues (`bg-zinc-250`, `text-zinc-550`, `text-amber-850`, `border-amber-520`, `text-red-650`, etc.) | classes potentiellement absentes | ⚠️ Important |

**Constat détaillé** : Le build n'échoue pas sur les classes inconnues, mais Tailwind v4 ne les génère pas. Visuellement, ces éléments peuvent apparaître sans couleur de fond/bordure/texte prévue.

**Correctifs suggérés** :
- Nettoyer les imports.
- Remplacer les classes inconnues par des valeurs valides (`bg-zinc-200`, `text-zinc-500`, etc.) ou des styles inline.
- Ajouter ESLint + `eslint-plugin-react-hooks`.

---

## 10. Performance

| Sujet | Statut | Problème |
|---|---|---|
| Manual chunks | ✅ OK | `leaflet`, `motion`, `react` séparés. |
| Photos dev dans le build | 🔴 **CRITIQUE** | `src/preview-photos*` (33 Mo + 6,7 Mo) sont emballés dans `dist/assets`. Le build fait **46 Mo**. |
| Recréation marqueurs | ⚠️ Confort | Tous les marqueurs sont recréés à chaque changement de filtres. |
| Pas de `React.memo` | ⚠️ Confort | Aucun composant lourd mémoïsé. |

**Constat détaillé** : Le build de production inclut 19 photos de `src/preview-photos` (ex. `Photo05_3A copie`, `amour copie`, etc.) car `PosterPreview.tsx` utilise `import.meta.glob('../preview-photos/*', { eager: true })`. Même si `PosterPreview` n'est monté qu'en dev, Vite inclut les assets référencés dans le graph.

**Correctifs suggérés** :
1. Déplacer `src/preview-photos*` dans un dossier exclu du build, par exemple `dev-assets/preview-photos/`.
2. Ou configurer Vite pour exclure `src/preview-photos*` :
```ts
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      external: [/preview-photos/],
    },
  },
});
```
3. Utiliser `import.meta.glob` lazy (`eager: false`) si vous souhaitez vraiment les garder dans `src`.

Après correction, le build devrait repasser sous **2 Mo**.

---

## 11. Accessibilité / UX mobile

| Sujet | Statut | Problème |
|---|---|---|
| Cibles tactiles | ⚠️ Confort | Chips du bandeau ~28 px de haut (recommandation 44 px). |
| Contraste HUD | ✅ OK | Texte blanc + ombres sur fond sombre. |
| `prefers-reduced-motion` | ✅ OK | Géré dans SplashScreen, route, DenzelMessage, etc. |
| Splash non passable | ⚠️ Confort | Pas de bouton "Passer" (2,2 s fixes). |
| Bottom nav | ✅ OK | `h-14` + `pb-safe`. |
| Marqueurs carte | ⚠️ Confort | Pas de `aria-label` sur les pins Leaflet. |

**Correctifs suggérés** :
- Ajouter un bouton "Passer" sur le splash.
- Ajouter `aria-label` sur les `L.divIcon` des marqueurs.
- Augmenter la hauteur des chips de filtre (`py-2` minimum).

---

## Priorisation globale

### 🔴 Critique (à corriger avant le séjour)
1. **Build de 46 Mo** : exclure `src/preview-photos*` du bundle production.
2. **Proxy `/api/gtaify` ouvert** : rate-limit, validation, restriction.
3. **IndexedDB non persistante** : demander `navigator.storage.persist()` sur iOS.
4. **Pas de backup** : offrir un export des photos.

### 🟠 Important (à corriger rapidement)
5. Activer `strict: true` dans TypeScript.
6. Améliorer le précaching PWA et la mise à jour du SW.
7. Nettoyer les assets dupliqués (`assets/` racine, `src/data/eljefe-avatar.webp`).
8. Corriger les classes Tailwind inconnues.
9. Gérer les refus de géolocalisation et les erreurs IndexedDB.
10. Ajouter un retry offline côté client pour la file GTA.

### 🟢 Confort (nice-to-have)
11. Nettoyer les imports inutilisés.
12. Ajouter `aria-label` sur les pins.
13. Bouton "Passer" sur le splash.
14. Mémoïser les composants lourds si besoin.

---

## Fichiers non modifiés, non commités

L'audit a été réalisé sur le working tree actuel. `git status` montre des modifications en cours (`package.json`, `package-lock.json`, `src/components/PosterPreview.tsx`) et des fichiers untracked (`AGENTS.md`, `assets/`, `scripts/`, `src/preview-photos*`, etc.). Il est recommandé de nettoyer le working tree avant de déployer.
