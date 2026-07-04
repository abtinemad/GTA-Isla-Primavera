# TEST-KIMI — Rapport de test du 21 juin 2026

> Session : test complet en lecture seule après une soirée de changements rapides.  
> Environnement : macOS, Node via Vite 6, React 19, TypeScript 5.8.  
> HEAD : `c1d7cfd`.

## Ce qui a été fait

1. Exécution de la pipeline obligatoire :
   - `npm run lint` → ✅
   - `npm run test` → ✅ 26/26
   - `npm run build` → ✅ (mais dist ~46 Mo)

2. Revue ciblée des fichiers modifiés ce soir :
   - `src/App.tsx`
   - `src/components/MapContainer.tsx`
   - `src/components/BottomSheet.tsx`
   - `src/utils/storage.ts` (relu partiellement)
   - `api/gtaify.ts` (relu)
   - `public/sw.js` (relu)

3. Mise à jour du plan file `~/.kimi/plans/green-lantern-red-star-stargirl.md` avec les constats.

## Ce qui fonctionne bien

- **Crash Leaflet/lucide résolu** : l'icône `Map` est importée sous l'alias `MapIcon`, libérant le global `Map` de Leaflet.
- **Carte stable** : ajout de `try/catch` par marqueur et par course pour éviter les white-screens ; position utilisateur animée.
- **Pulse de proximité** : spots et départs de course pulsent en `soft`/`strong` selon la distance ; la proximité prend le pas sur les filtres.
- **Missions chrono manuelles** : filet de sécurité avec `pendingTime` + validation photo, en complément du géofence automatique.
- **Plages corrigées** : elles utilisent maintenant `isPhotoSlot()` et ont le même bouton de validation photo que les Escapades.
- **Message ambient d'El Jefe** : le flag `ambientFiredRef` n'est posé qu'après le guard de run actif et le cooldown 30 min.
- **Persist iOS** : `navigator.storage.persist()` est appelé après le premier geste utilisateur, avec bandeau discret si refusé.
- **File GTA** : `gtaDoneRef` évite le double appel pendant la fenêtre de commit React.

## Ce qui inquiète

- **Build de 46 Mo** : c'est le problème le plus visible. Les dossiers `src/preview-photos*` sont `.gitignore` mais présents localement, donc Vite les embarque. À corriger avant tout déploiement.
- **Proxy GTA ouvert** : pas de rate-limit, pas de validation de taille/type. C'est une porte ouverte sur la facturation Google API.
- **Aucun backup/export** : les photos sont dans IndexedDB. Si l'utilisateur change de téléphone ou si Safari purge, les souvenirs disparaissent.
- **SW sans prompt de mise à jour** : l'utilisateur peut rester sur une vieille version de l'app sans le savoir.
- **Classes Tailwind exotiques** (`bg-zinc-250`, etc.) : pas bloquant mais fragile.

## Ce qui reste à tester en conditions réelles

- Géolocalisation sur iPhone Safari / PWA standalone.
- Geofence réel à 50 m et 500 m.
- Web Share natif vers l'app Photos.
- Install PWA et icône sur écran d'accueil.
- Persistance IndexedDB après 7+ jours d'inactivité sur iOS.
- Stylisation GTA en 4G/EDGE (latence, timeout).
- Caméra et compression sur un vrai appareil.

## Verdict subjectif

L'app est fonctionnelle et les bugs bloquants de la soirée ont été corrigés. Les deux points rouges à traiter avant la prochaine mise en ligne sont **le build 46 Mo** et **la sécurisation du proxy GTA**. Le reste est du confort ou de la résilience.
