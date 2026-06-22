/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationItem } from '../types';
import { buildMarkerHtml, locationVariant } from '../utils/helper';
import { CourseData } from '../data/coursesData';
import { ISLA_PHRASES } from '../data/islaPhrases';
import { Plus, Minus, Layers } from 'lucide-react';

// Contrôles flottants — palette HUD partagée (tokens de tokens.css), comme le
// bandeau de filtres : fond glass sombre + filet --hairline. Plus de gris zinc/Leaflet.
const CTRL_CLASS =
  'rounded-2xl border shadow-xl active:scale-95 transition-all cursor-pointer flex items-center justify-center hover:brightness-125';
const CTRL_STYLE = {
  background: 'color-mix(in srgb, var(--surface) 82%, transparent)',
  borderColor: 'var(--hairline)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
};

interface MapContainerProps {
  locations: LocationItem[];
  selectedLocation: LocationItem | null;
  onSelectLocation: (location: LocationItem) => void;
  userCoords: { lat: number; lng: number } | null;
  /** Pulse de proximité par id de spot : 'soft' (approche) | 'strong' (rayon d'action). */
  pulseLevels: Record<number, 'soft' | 'strong'>;
  /** Pulse de proximité par id de COURSE (pin depart) : 'soft' | 'strong'. */
  coursePulseLevels?: Record<string, 'soft' | 'strong'>;
  /** Opens El Jefe's messages (the dog) — replay of the guided onboarding. */
  onOpenDenzel: () => void;
  /** Tap on the wallet (sous l'avatar) → message d'El Jefe. */
  onWalletClick: () => void;
  /** Pin labels (tooltips) show only when exactly one filter group is active. */
  singleGroupActive?: boolean;
  completedLocations?: number[];
  /** Spots « visités » (lien ouvert) — grisage léger, sans ✓. */
  visitedLocations?: number[];
  /** Races — sole source of courses (src/data/coursesData.ts). */
  courses?: CourseData[];
  /** Whether the Courses filter is on (show course pins at all). */
  coursesActive?: boolean;
  /** Reveal every course route at once (Courses filter isolated). */
  coursesFocused?: boolean;
  /** Ids of completed courses (run done) — marks the photo-point pin with a ✓. */
  completedCourseIds?: string[];
  /** Course photos ({ [courseId]: base64 }) — adds a 📸 badge on the photo-point
   *  pin, independent of the run ✓. */
  coursePhotos?: Record<string, string>;
  selectedCourseId?: string | null;
  onSelectCourse?: (course: CourseData) => void;
}

export default function MapContainer({
  locations,
  selectedLocation,
  onSelectLocation,
  userCoords,
  pulseLevels,
  coursePulseLevels = {},
  onOpenDenzel,
  onWalletClick,
  singleGroupActive = false,
  completedLocations = [],
  visitedLocations = [],
  courses = [],
  coursesActive = false,
  coursesFocused = false,
  completedCourseIds = [],
  coursePhotos = {},
  selectedCourseId = null,
  onSelectCourse
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<number, L.Marker>>({});
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'plan'>('satellite');
  const tileLayersRef = useRef<L.TileLayer[]>([]);

  // Aphorismes Isla Primavera (bas de carte) — rotation simple 10 s (séquentielle,
  // donc sans répétition consécutive). Source unique : src/data/islaPhrases.ts.
  const [phraseIdx, setPhraseIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setPhraseIdx((i) => (i + 1) % ISLA_PHRASES.length), 10000);
    return () => window.clearInterval(id);
  }, []);
  // Course tracks (route line + finish pin) — only mounted when revealed.
  const courseLayersRef = useRef<L.LayerGroup | null>(null);
  // Markers « depart » des courses indexés par id → pour appliquer le pulse de
  // proximité dessus (même mécanisme que les pins de spot).
  const courseDepartMarkersRef = useRef<Record<string, L.Marker>>({});

  // 1. Initialize Map (run only once on mount)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Tenerife coordinates approx lat: 28.29, lng: -16.62, zoom: 10
    const map = L.map(mapContainerRef.current, {
      zoomControl: false, // custom zoom buttons live in the floating control column
      minZoom: 9,
      maxZoom: 18,
    }).setView([28.18, -16.65], 11);

    mapRef.current = map;
    setMapInstance(map);

    // No permanent tracks are drawn on the map: navigation happens in Google
    // Maps via the sheet's "Y aller" button. The only line ever rendered is a
    // course route, and only when revealed (see the course effect below).

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      // Reset every layer/marker handle so a remount (e.g. React StrictMode's
      // mount→unmount→remount) doesn't reuse refs tied to the destroyed map —
      // otherwise the user-position dot can silently fail to re-appear.
      userMarkerRef.current = null;
      markersRef.current = {};
      tileLayersRef.current = [];
      courseLayersRef.current = null;
      setMapInstance(null);
    };
  }, []);

  // 1b. Switch base layer: daytime satellite (raster) vs clean street plan
  useEffect(() => {
    if (!mapInstance) return;

    tileLayersRef.current.forEach(layer => layer.remove());
    tileLayersRef.current = [];

    if (mapStyle === 'satellite') {
      // Bright daytime satellite imagery (lightened in CSS so the sea isn't dark).
      const baseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: 'Imagery &copy; Esri', className: 'leaflet-satellite-base map-tint-sat'
      }).addTo(mapInstance);
      const labelsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: '', className: 'leaflet-satellite-roads'
      }).addTo(mapInstance);
      tileLayersRef.current = [baseLayer, labelsLayer];

    } else {
      // Clean street plan (Google/Apple-Maps style) — CARTO Voyager raster tiles.
      const plan = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20, subdomains: 'abcd',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        className: 'leaflet-plan-tiles map-tint-plan'
      }).addTo(mapInstance);
      tileLayersRef.current = [plan];
    }
  }, [mapInstance, mapStyle]);

  // 2. Synchronize user's live position marker. Depends on mapInstance so it
  // re-runs once the map exists (or is recreated), not only on userCoords change.
  useEffect(() => {
    const map = mapInstance;
    if (!map) return;

    if (userCoords) {
      const livePulseIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center w-5 h-5">
            <!-- Ripple Wave -->
            <span class="absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-70 animate-ping"></span>
            <!-- Solid Core -->
            <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-sky-400 border-2 border-zinc-900 shadow-md"></span>
          </div>
        `,
        className: 'custom-div-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userCoords.lat, userCoords.lng]);
      } else {
        userMarkerRef.current = L.marker([userCoords.lat, userCoords.lng], {
          icon: livePulseIcon,
          zIndexOffset: 1000 // Ensure always on top
        }).addTo(map);
      }
    } else {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    }
  }, [userCoords, mapInstance]);

  // 3. Render / Update Location Markers on dataset/filter change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    Object.values(markersRef.current).forEach((marker: any) => marker.remove());
    markersRef.current = {};

    // Spawn markers for current visible locations. Trophy entries (id 101-105)
    // share the exact coordinates of their physical mission/spot, so rendering
    // them would stack a duplicate pin on top of the real one — skip them here.
    locations
      .filter((loc) => !loc.category.startsWith('🏆'))
      .forEach((loc) => {
      try {
      // Match by coordinates, not id: a selected trophy entry (id 101-105)
      // shares the exact coords of its physical twin, so the twin pin lights up.
      const isSelected = !!selectedLocation
        && selectedLocation.lat === loc.lat
        && selectedLocation.lng === loc.lng;
      const isCompleted = completedLocations.includes(loc.id);
      
      const customIcon = L.divIcon({
        html: buildMarkerHtml(locationVariant(loc), isSelected, isCompleted),
        className: 'custom-div-icon',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const marker = L.marker([loc.lat, loc.lng], {
        icon: customIcon,
      });

      marker.on('click', () => {
        onSelectLocation(loc);
      });

      // Permanent label, but only when a single category is isolated — otherwise
      // labels overlap (esp. around the QG cluster), so we keep pins only.
      if (singleGroupActive) {
        const categoryClass = 'tooltip-' + loc.category.toLowerCase().replace(/[^a-z0-9]/g, '');
        marker.bindTooltip(loc.name, {
          permanent: true,
          direction: 'bottom',
          offset: [0, 16],
          className: `custom-map-tooltip ${categoryClass}`
        });
      }

      marker.addTo(map);
      markersRef.current[loc.id] = marker;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[pin build] marqueur ignoré', loc?.id, e);
      }
    });
  }, [locations, selectedLocation, onSelectLocation, completedLocations, singleGroupActive]);

  // 3b. État visuel des markers — pulse de proximité + grisage « fait/visité »,
  // basculé par TOGGLE de classe sur l'ÉLÉMENT (pas de recréation d'icône). Dépend
  // aussi de `locations` pour ré-appliquer après la recréation des marqueurs
  // (changement de filtre/proximité). Robuste : ne touche qu'aux markers existants et
  // vérifie l'existence de l'élément avant manip.
  useEffect(() => {
    for (const idStr of Object.keys(markersRef.current)) {
      try {
        const id = Number(idStr);
        const marker = markersRef.current[id];
        const el = marker?.getElement();
        if (!el) continue;
        const level = pulseLevels[id];
        el.classList.toggle('pin-pulse', level === 'soft');
        el.classList.toggle('pin-pulse-strong', level === 'strong');
        // « Fait » (validé : photo/chrono — ✓ déjà dans le SVG) vs « visité » (lien
        // ouvert, signal plus léger). Validé prime sur visité.
        const done = completedLocations.includes(id);
        el.classList.toggle('pin-done', done);
        el.classList.toggle('pin-visited', !done && visitedLocations.includes(id));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[pin state] toggle échoué', idStr, e);
      }
    }
  }, [pulseLevels, completedLocations, visitedLocations, locations]);

  // 4. Handle smooth focusing when selectedLocation changes (e.g., from lists or indicators)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedLocation) return;

    // Programmatically slide/pan map to the targeted location
    // We adjust the zoom offset slightly on mobile to keep views clean
    const targetZoom = map.getZoom() < 12 ? 12 : map.getZoom();
    map.flyTo([selectedLocation.lat - 0.012, selectedLocation.lng], targetZoom, {
      duration: 1.5,
      easeLinearity: 0.25,
    });

    // Update marker size style cleanly
    Object.entries(markersRef.current).forEach(([idString, marker]: [string, any]) => {
      const id = parseInt(idString);
      const loc = locations.find((l) => l.id === id);
      const isSelected = !!loc
        && selectedLocation.lat === loc.lat
        && selectedLocation.lng === loc.lng;
      const isCompleted = completedLocations.includes(id);

      if (loc) {
        const updatedIcon = L.divIcon({
          html: buildMarkerHtml(locationVariant(loc), isSelected, isCompleted),
          className: 'custom-div-icon',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        marker.setIcon(updatedIcon);
        if (isSelected) {
          marker.setZIndexOffset(999);
        } else {
          marker.setZIndexOffset(0);
        }
      }
    });

  }, [selectedLocation, locations, completedLocations]);

  // Signature STABLE de l'ensemble des courses « proches » (ids triés) → l'effet de
  // construction du layer course ne se relance QUE quand cet ensemble change (pas à
  // chaque fix GPS). Le niveau soft/strong, lui, est appliqué par le toggle de classe.
  const coursePulseKey = Object.keys(coursePulseLevels).sort().join(',');

  // 5. Courses (races) — sole source = coursesData. When the Courses filter is
  // on, every course shows a depart pin (clickable) + a finish pin. The route
  // line is the ONLY line ever drawn and never permanently: it is revealed only
  // when the Courses filter is isolated (coursesFocused) OR when a course's
  // depart pin is tapped. Otherwise only the depart/finish pins show.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (courseLayersRef.current) {
      courseLayersRef.current.remove();
      courseLayersRef.current = null;
    }
    courseDepartMarkersRef.current = {};

    const group = L.layerGroup();

    courses.forEach((course) => {
      try {
      // PROXIMITÉ > FILTRE : une course s'affiche si le filtre Courses est actif OU
      // si on est dans son rayon d'approche (coursePulseLevels) — même chip masqué.
      const nearby = coursePulseLevels[course.id] !== undefined;
      if (!coursesActive && !nearby) return;

      const isSelected = selectedCourseId === course.id;
      const isCompleted = completedCourseIds.includes(course.id);
      // The photo point (✓ run + 📸 photo) is the start when photoAtStart, else the end.
      const departDone = isCompleted && !!course.photoAtStart;
      const arriveeDone = isCompleted && !course.photoAtStart;
      const hasPhoto = !!coursePhotos[course.id];
      const departPhoto = hasPhoto && !!course.photoAtStart;
      const arriveePhoto = hasPhoto && !course.photoAtStart;

      // Depart pin (clickable → opens the course sheet) — toujours rendu pour une
      // course affichée (filtre actif OU proche). C'est lui qui porte le pulse.
      const depart = L.marker([course.start.lat, course.start.lng], {
        icon: L.divIcon({
          html: buildMarkerHtml('course-depart', isSelected, departDone, departPhoto),
          className: 'custom-div-icon',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
        zIndexOffset: isSelected ? 900 : 300,
      });
      depart.on('click', () => onSelectCourse?.(course));
      courseDepartMarkersRef.current[course.id] = depart;
      if (singleGroupActive) {
        depart.bindTooltip(course.title, {
          permanent: true,
          direction: 'bottom',
          offset: [0, 16],
          className: 'custom-map-tooltip tooltip-missions',
        });
      }
      depart.addTo(group);

      // Tracé + pin d'arrivée : détails complets UNIQUEMENT quand le filtre Courses
      // est actif. Une course juste « proche » (hors filtre) n'affiche que son départ.
      if (coursesActive) {
        // Tous les trajets s'affichent dès que le filtre Courses est actif (plus
        // besoin d'isoler le filtre ni de sélectionner une course). Emphase : la
        // course sélectionnée (ou quand aucune n'est sélectionnée) garde le trait
        // plein ; les autres sont légèrement atténuées pour éviter le spaghetti.
        if (course.route.length >= 2) {
          const pts = course.route.map((p) => [p.lat, p.lng] as [number, number]);
          const emphasized = !selectedCourseId || isSelected;
          L.polyline(pts, {
            color: '#000000', weight: emphasized ? 8 : 6, opacity: emphasized ? 0.5 : 0.32, lineCap: 'round', lineJoin: 'round', interactive: false,
          }).addTo(group);
          L.polyline(pts, {
            color: '#EA4423', weight: emphasized ? 4 : 3, opacity: emphasized ? 0.97 : 0.72, lineCap: 'round', lineJoin: 'round', interactive: false, className: 'course-route',
          }).addTo(group);
        }
        L.marker([course.end.lat, course.end.lng], {
          icon: L.divIcon({
            html: buildMarkerHtml('course-arrivee', isSelected, arriveeDone, arriveePhoto),
            className: 'custom-div-icon',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          }),
          interactive: false,
          zIndexOffset: isSelected ? 880 : 280,
        }).addTo(group);
      }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[course build] course ignorée', course?.id, e);
      }
    });

    group.addTo(map);
    courseLayersRef.current = group;

    return () => {
      if (courseLayersRef.current) {
        courseLayersRef.current.remove();
        courseLayersRef.current = null;
      }
      courseDepartMarkersRef.current = {};
    };
    // coursePulseLevels lu pour la PRÉSENCE (proximité > filtre) ; on dépend de
    // coursePulseKey (signature stable) pour éviter un rebuild à chaque fix GPS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, coursesActive, coursesFocused, completedCourseIds, coursePhotos, selectedCourseId, onSelectCourse, singleGroupActive, coursePulseKey]);

  // 5c. Pulse de proximité sur les pins de course (depart) — MÊME mécanisme que les
  // pins de spot : toggle de classe sur l'élément, garde d'existence. Dépend aussi des
  // déclencheurs de recréation du layer course → ré-appliqué après reconstruction.
  useEffect(() => {
    for (const id of Object.keys(courseDepartMarkersRef.current)) {
      try {
        const el = courseDepartMarkersRef.current[id]?.getElement();
        if (!el) continue;
        const level = coursePulseLevels[id];
        el.classList.toggle('pin-pulse', level === 'soft');
        el.classList.toggle('pin-pulse-strong', level === 'strong');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[course pulse] toggle échoué', id, e);
      }
    }
  }, [coursePulseLevels, courses, coursesActive, coursesFocused, completedCourseIds, coursePhotos, selectedCourseId]);

  // 5b. Fly to a course when it is selected (its depart pin was tapped).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCourseId) return;
    const course = courses.find((c) => c.id === selectedCourseId);
    if (!course) return;
    const targetZoom = map.getZoom() < 12 ? 12 : map.getZoom();
    map.flyTo([course.start.lat - 0.012, course.start.lng], targetZoom, {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [selectedCourseId, courses]);

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${
      mapStyle === 'satellite' ? 'bg-[#6F9ABE] map-satellite-theme' : 'bg-[#e8e4dd] map-plan-theme'
    }`}>
      
      {/* Map Division Ref */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Vice/Manrique sunset wash over the tiles (below the HUD controls) */}
      <div className="map-tint" aria-hidden />

      {/* Floating control column (top-right) — single stack, top to bottom:
          zoom +, zoom −, satellite/plan toggle, El Jefe (dog) messages.
          Offset below the on-map filter bar so they never overlap. */}
      <div
        className="absolute right-3 z-[500] flex flex-col items-end gap-2"
        style={{ top: 'calc(env(safe-area-inset-top) + 6.5rem)' }}
      >

        {/* Zoom in */}
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className={`${CTRL_CLASS} p-3`}
          style={CTRL_STYLE}
          aria-label="Zoom avant"
          title="Zoom avant"
        >
          <Plus size={18} className="text-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.5)]" />
        </button>

        {/* Zoom out */}
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className={`${CTRL_CLASS} p-3`}
          style={CTRL_STYLE}
          aria-label="Zoom arrière"
          title="Zoom arrière"
        >
          <Minus size={18} className="text-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.5)]" />
        </button>

        {/* Map Style Toggle — même palette HUD ; état « plan » = accent cyan rempli. */}
        <button
          onClick={() => setMapStyle(prev => (prev === 'satellite' ? 'plan' : 'satellite'))}
          className={`${CTRL_CLASS} p-3`}
          style={
            mapStyle === 'plan'
              ? { ...CTRL_STYLE, background: 'rgba(34,211,238,0.16)', borderColor: 'rgba(34,211,238,0.55)' }
              : CTRL_STYLE
          }
          title={mapStyle === 'satellite' ? 'Vue Plan' : 'Vue Satellite'}
        >
          <Layers size={18} className="text-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.5)]" />
        </button>

        {/* El Jefe (dog) — replay the guided messages/onboarding */}
        <button
          onClick={onOpenDenzel}
          className={`${CTRL_CLASS} p-1 overflow-hidden`}
          style={CTRL_STYLE}
          aria-label="Messages d'El Jefe"
          title="Messages d'El Jefe"
        >
          <img
            src="/assets/eljefe-avatar-circle.png"
            alt="El Jefe"
            className="w-9 h-9 rounded-full object-cover"
          />
        </button>

        {/* WALLET — texte flottant sous le chien (sans conteneur ni badge),
            solde négatif en rouge style GTA, tap → message d'El Jefe. */}
        <button
          onClick={onWalletClick}
          className="mt-0.5 mr-1 font-mono text-sm font-black italic text-red-400 leading-none active:scale-95 cursor-pointer select-none bg-transparent border-0 p-0"
          style={{ textShadow: '0 2px 5px rgba(0,0,0,0.95), 0 0 7px rgba(248,113,113,0.6)' }}
          aria-label="Portefeuille"
          title="Portefeuille"
        >
          -87 €
        </button>

      </div>

      {/* Aphorisme Isla Primavera — ligne discrète en bas de carte (rotation).
          pointer-events-none + z sous les contrôles : ne masque ni pins ni HUD. */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-[400] flex justify-center px-6"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
      >
        <span
          key={phraseIdx}
          className="isla-phrase max-w-[88%] text-center font-display italic text-[11px] sm:text-xs leading-snug tracking-wide"
          style={{ color: 'rgba(239,240,242,0.82)', textShadow: '0 1px 6px rgba(0,0,0,0.95)' }}
        >
          {ISLA_PHRASES[phraseIdx]}
        </span>
      </div>
    </div>
  );
}
