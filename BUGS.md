# BUGS & BUGUETTES — Grand Tenerife Auto : Isla Primavera

> Liste des bugs, incohérences et comportements suspects identifiés lors de l'audit. Aucun fichier source n'a été modifié.

## 🔴 Critiques

### 1. Build de production de 46 Mo (photos dev-only embarquées)
- **Fichier** : `src/components/PosterPreview.tsx:22-23`
- **Problème** : `import.meta.glob('../preview-photos/*', { eager: true })` et `import.meta.glob('../preview-photos-gta/*', { eager: true })` incluent les 33 Mo + 6,7 Mo de photos dev dans le bundle de production.
- **Conséquence** : `dist/` fait **46 Mo**. Temps de chargement prohibitif sur 3G/4G, mauvais score Lighthouse, risque de timeout d'installation PWA.
- **Correctif** : déplacer `src/preview-photos*` hors du build (dossier `dev-assets/`) ou utiliser `eager: false` / exclusion Vite.

### 2. Proxy `/api/gtaify` totalement ouvert
- **Fichier** : `api/gtaify.ts`
- **Problème** : aucun rate-limit, authentification, validation de taille/type, ni restriction CORS.
- **Conséquence** : n'importe qui peut spammer le proxy et vider le crédit Google.
- **Correctif** : rate-limit par IP/session, limite de taille (~2 Mo), validation base64, restriction d'origine si pertinent.

### 3. IndexedDB non persistante sur iOS
- **Fichier** : `src/App.tsx`, `src/utils/storage.ts`
- **Problème** : `navigator.storage.persist()` n'est jamais appelé.
- **Conséquence** : sur iOS, Safari peut purger IndexedDB après ~7 jours d'inactivité → perte des photos prises pendant le séjour.
- **Correctif** : demander `navigator.storage.persist()` au montage (après un geste utilisateur si nécessaire) et informer si refusé.

### 4. Aucun backup/export des photos
- **Fichier** : `src/components/CoverQuest.tsx`, `src/components/PosterComposer.tsx`
- **Problème** : les photos sont prisonnières de l'appareil. Pas d'export ZIP, pas de sauvegarde cloud.
- **Conséquence** : perte/casse du téléphone = perte irréversible des souvenirs.
- **Correctif** : ajouter un export ZIP via JSZip + Web Share, ou partage multi-fichiers.

### 5. Incohérence : les Plages sont attendues dans la jaquette mais plus validables
- **Fichiers** : `src/coverData.ts:18,30`, `src/components/BottomSheet.tsx:685-697`, `src/App.tsx:419`
- **Problème** :
  - `coverData.ts` considère `Plages` comme `COMPLETABLE_CATEGORIES` et `isPhotoSlot`.
  - `BottomSheet.tsx` n'affiche le bouton "Prendre une photo pour valider" que pour `Escapades` (commentaire "Les Plages ne valident plus rien").
  - Donc les Plages apparaissent dans `COVER_LOCATIONS` et reçoivent des notifications d'approche "prends ta photo", mais il n'y a aucun moyen de les valider.
- **Correctif** : soit retirer `Plages` de `COMPLETABLE_CATEGORIES` / `isPhotoSlot`, soit réactiver leur validation par photo.

### 6. Message ambient d'El Jefe bloqué définitivement si un run est actif
- **Fichier** : `src/App.tsx:323-345`
- **Problème** : `ambientFiredRef.current = true` est exécuté **avant** le test `if (activeRunLocationId !== null) return;`. Si un run est actif au moment où le splash disparaît, le ref passe à `true` mais le message n'est pas affiché. La prochaine fois que l'utilisateur ouvre l'app sans run, le message ne sera toujours pas affiché.
- **Correctif** : déplacer `ambientFiredRef.current = true` après le return, dans le bloc où le message est réellement affiché.

---

## 🟠 Importants

### 7. Accès `localStorage` sans `try/catch`
- **Fichiers** : `src/App.tsx:242-244, 263, 296, 339, 573, 612, 617`
- **Problème** : plusieurs `localStorage.setItem/getItem/removeItem` ne sont pas protégés. En navigation privée Safari ou en cas de quota atteint, cela lève une exception.
- **Conséquence** : la progression peut apparaître comme validée en UI mais ne pas être persistée.
- **Correctif** : wrapper tous les accès localStorage dans `try/catch`.

### 8. Notifications d'approche orphelines
- **Fichier** : `src/App.tsx:686-704`
- **Problème** :
  - Pour `Missions` : la notification dit "Prépare ton run chrono", mais les Missions sont exclues de la carte/liste (sauf via trophées fly-to). L'utilisateur ne peut pas facilement lancer le run.
  - Pour `Plages` : la notification invite à prendre une photo, mais le bouton de validation n'existe plus (voir bug 5).
- **Correctif** : aligner les notifications avec les actions réellement disponibles.

### 9. Race condition théorique dans la file GTA
- **Fichier** : `src/App.tsx:159-183`
- **Problème** : `gtaInflightRef.current.delete(job.key)` est exécuté dans le `finally`, **avant** `setGtaPhotos(...)`. Entre les deux, l'effet d'auto-enqueue peut ré-ajouter la photo à la file car `gtaInflightRef` ne la contient plus et `gtaPhotos` ne la contient pas encore.
- **Conséquence** : traitement en double d'une même photo (facturation doublée côté Google).
- **Correctif** : ne supprimer la clé de `gtaInflightRef` qu'après la mise à jour de `gtaPhotos`, ou marquer explicitement "completed".

### 10. Pas de gestion de mise à jour du Service Worker
- **Fichier** : `src/main.tsx:20-25`
- **Problème** : le SW s'enregistre, mais le client n'écoute jamais `updatefound` / `controllerchange`.
- **Conséquence** : un onglet laissé ouvert continue de servir l'ancien build après un déploiement.
- **Correctif** : afficher une popup "Nouvelle version disponible, recharger ?".

### 11. Splash non passable
- **Fichier** : `src/components/SplashScreen.tsx`
- **Problème** : 2,2 s fixes + 0,5 s de fondu, sans bouton "Passer".
- **Conséquence** : mauvaise UX pour les utilisateurs pressés ou avec `prefers-reduced-motion`.
- **Correctif** : ajouter un bouton/tap "Passer".

### 12. Classes Tailwind inconnues / invalides
- **Fichiers** : `src/components/BottomSheet.tsx`, `src/components/LocationsList.tsx`
- **Problème** : classes comme `bg-zinc-250`, `text-zinc-550`, `text-zinc-650`, `bg-amber-805`, `border-amber-250`, `border-amber-520`, `text-amber-850`, `text-red-650`, `border-red-250`, `text-rose-550` n'existent pas dans Tailwind.
- **Conséquence** : ces éléments risquent d'apparaître sans couleur de fond/bordure/texte.
- **Correctif** : remplacer par les classes Tailwind valides les plus proches (`bg-zinc-200`, `text-zinc-500`, `text-amber-800`, etc.).

### 13. Thème non changeable
- **Fichier** : `src/App.tsx:284-300`
- **Problème** : `theme` et `setTheme` existent, mais aucun bouton/élément d'UI ne permet de changer le thème.
- **Conséquence** : l'utilisateur est coincé en dark (ou en light s'il avait déjà une préférence sauvegardée).
- **Correctif** : ajouter un toggle dans le HUD (MapContainer) ou le Social Club.

### 14. Timeouts non nettoyés
- **Fichiers** : `src/components/BottomSheet.tsx:438-465`, `src/components/CoverQuest.tsx:159`, `src/components/PosterComposer.tsx:85,290`
- **Problème** : plusieurs `setTimeout` ne sont pas annulés si le composant est démonté (ou si la fiche se ferme) avant leur expiration.
- **Conséquence** : fuites de timers, rendus inutiles, et dans le cas de `BottomSheet`, exécution de code sur une fiche déjà fermée.
- **Correctif** : stocker les `timeoutId` dans des refs et les `clearTimeout` dans le cleanup.

---

## 🟢 Confort / mineurs

### 15. Imports `React` inutiles
- **Fichiers** : `src/components/BottomSheet.tsx:6`, `src/components/CoursePhotoPrompt.tsx:6`
- **Problème** : `import React from 'react'` n'est plus nécessaire avec React 19 + transform `react-jsx`.
- **Correctif** : supprimer ces imports.

### 16. Import `MapPin` inutilisé
- **Fichier** : `src/components/LocationsList.tsx:10`
- **Correctif** : supprimer.

### 17. Type `FilterOption` inutilisé
- **Fichier** : `src/types.ts:43-47`
- **Correctif** : supprimer ou utiliser.

### 18. `devMode` figé après changement d'URL
- **Fichier** : `src/App.tsx:239-248`
- **Problème** : `devMode` est calculé une seule fois via `useMemo(..., [])`. Si l'utilisateur change `?dev=1` en `?dev=0` sans recharger, la valeur reste inchangée jusqu'au prochain reload.
- **Correctif** : utiliser un effet qui réagit à `window.location.search`.

### 19. Mise à jour des marqueurs en retard
- **Fichier** : `src/components/MapContainer.tsx:244-281`
- **Problème** : quand `selectedLocation` change, l'effet met à jour les marqueurs via `markersRef.current`. Si un changement de filtres a recréé les marqueurs entre temps, l'ancienne référence peut être `undefined` et le marqueur sélectionné ne prend pas la bonne apparence.
- **Correctif** : vérifier l'existence du marker avant d'appeler `setIcon` / `setZIndexOffset`.

### 20. Pins de carte sans `aria-label`
- **Fichier** : `src/components/MapContainer.tsx:211-239`, `288-383`
- **Problème** : les marqueurs générés via `L.divIcon` n'ont pas d'attribut `aria-label`.
- **Conséquence** : les lecteurs d'écran ne savent pas quel spot est cliquable.
- **Correctif** : ajouter `aria-label={loc.name}` dans le HTML du marqueur.

### 21. `FilterOption` dans `types.ts`
- Déjà mentionné en 17.

---

## Bonus : code mort / duplications

- Dossier `assets/` à la racine (1,2 Mo) duplique `src/assets/` — non référencé dans le code.
- `src/data/eljefe-avatar.webp` est un fichier untracked en double de `src/assets/eljefe-avatar.webp`.
- Le state `activeRunLocationId` et le code de chrono Mission legacy (`handleStartRun` / `handleStopRun`) sont fonctionnellement inaccessibles depuis la carte/liste (Missions exclues), seulement via les trophées fly-to.

---

## Recommandation de priorité

1. Corriger d'abord les bugs **critiques** 1, 2, 3, 5, 6 avant tout déploiement.
2. Puis les bugs **importants** 7, 8, 9, 10, 12, 13, 14.
3. Enfin les points **confort** 15-20 lors d'un nettoyage.
