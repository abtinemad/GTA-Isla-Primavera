/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationItem } from '../types';
import { buildMarkerHtml, courseRoutePoints, locationVariant } from '../utils/helper';
import { Compass, Navigation, Layers } from 'lucide-react';

interface MapContainerProps {
  locations: LocationItem[];
  selectedLocation: LocationItem | null;
  onSelectLocation: (location: LocationItem) => void;
  userCoords: { lat: number; lng: number } | null;
  onRequestGeolocation: () => void;
  completedLocations?: number[];
  /** Reveal every course route at once (Courses filter isolated). */
  coursesFocused?: boolean;
}

export default function MapContainer({
  locations,
  selectedLocation,
  onSelectLocation,
  userCoords,
  onRequestGeolocation,
  completedLocations = [],
  coursesFocused = false
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<number, L.Marker>>({});
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'plan'>('satellite');
  const tileLayersRef = useRef<L.TileLayer[]>([]);
  // Course tracks (route line + finish pin) — only mounted when revealed.
  const courseLayersRef = useRef<L.LayerGroup | null>(null);

  // 1. Initialize Map (run only once on mount)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Tenerife coordinates approx lat: 28.29, lng: -16.62, zoom: 10
    const map = L.map(mapContainerRef.current, {
      zoomControl: false, // will add customized zoom controls later or position them cleanly
      minZoom: 9,
      maxZoom: 18,
    }).setView([28.18, -16.65], 11);

    // Add clean zoom control on top right
    L.control.zoom({
      position: 'topright'
    }).addTo(map);

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
        maxZoom: 19, attribution: 'Imagery &copy; Esri', className: 'leaflet-satellite-base'
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
        className: 'leaflet-plan-tiles'
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

      // Bind permanent tooltip with dynamic category class for stark neon colors
      const categoryClass = 'tooltip-' + loc.category.toLowerCase().replace(/[^a-z0-9]/g, '');
      marker.bindTooltip(loc.name, {
        permanent: true,
        direction: 'bottom',
        offset: [0, 16],
        className: `custom-map-tooltip ${categoryClass}`
      });

      marker.addTo(map);
      markersRef.current[loc.id] = marker;
    });
  }, [locations, selectedLocation, onSelectLocation, completedLocations]);

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

  // 5. Course tracks — the ONLY line ever drawn, and never permanently. A course
  // route (+ its finish pin) is revealed when the Courses filter is isolated
  // (coursesFocused) OR when its depart pin is selected. Otherwise only the
  // depart pin shows.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (courseLayersRef.current) {
      courseLayersRef.current.remove();
      courseLayersRef.current = null;
    }

    const group = L.layerGroup();

    locations.forEach((loc) => {
      if (loc.missionType !== 'course' || !loc.course) return;
      const isSelected = !!selectedLocation && selectedLocation.id === loc.id;
      if (!coursesFocused && !isSelected) return;

      const pts = courseRoutePoints(loc.course).map(
        (p) => [p.lat, p.lng] as [number, number]
      );

      // Dark casing underneath for contrast, red top line with a soft glow +
      // an animated dash flow (the flow is disabled by prefers-reduced-motion
      // in CSS — see `.course-route`).
      L.polyline(pts, {
        color: '#000000',
        weight: 8,
        opacity: 0.5,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(group);
      L.polyline(pts, {
        color: '#EA4423',
        weight: 4,
        opacity: 0.97,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
        className: 'course-route',
      }).addTo(group);

      // Finish pin (checkered flag), non-interactive.
      const { end } = loc.course;
      L.marker([end.lat, end.lng], {
        icon: L.divIcon({
          html: buildMarkerHtml('course-arrivee', isSelected, false),
          className: 'custom-div-icon',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
        interactive: false,
        zIndexOffset: 400,
      }).addTo(group);
    });

    group.addTo(map);
    courseLayersRef.current = group;

    return () => {
      if (courseLayersRef.current) {
        courseLayersRef.current.remove();
        courseLayersRef.current = null;
      }
    };
  }, [locations, selectedLocation, coursesFocused]);
  const handleRecenterIsland = () => {
    if (mapRef.current) {
      mapRef.current.flyTo([28.18, -16.65], 11, { duration: 1.2 });
    }
  };

  // Quick Action: Fly to user position
  const handleFlyToUser = () => {
    if (userCoords && mapRef.current) {
      mapRef.current.flyTo([userCoords.lat, userCoords.lng], 13, { duration: 1.2 });
    } else {
      onRequestGeolocation();
    }
  };

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${
      mapStyle === 'satellite' ? 'bg-[#6F9ABE] map-satellite-theme' : 'bg-[#e8e4dd] map-plan-theme'
    }`}>
      
      {/* Map Division Ref */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Vice/Manrique sunset wash over the tiles (below the HUD controls) */}
      <div className="map-tint" aria-hidden />

      {/* Embedded floating control hub */}
      <div className="absolute left-4 bottom-22 md:bottom-6 flex flex-col gap-2 z-[500]">
        
        {/* Recenter Island Button */}
        <button
          onClick={handleRecenterIsland}
          className="bg-zinc-950 hover:bg-zinc-900 active:scale-95 text-cyan-400 p-3.5 rounded-2xl border border-zinc-800 shadow-xl transition-all cursor-pointer flex items-center justify-center"
          title="Centrer sur Tenerife"
        >
          <Compass size={18} className="animate-spin-slow text-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.5)]" />
        </button>

        {/* Map Style Toggle Button */}
        <button
          onClick={() => {
            setMapStyle(prev => prev === 'satellite' ? 'plan' : 'satellite');
          }}
          className={`
            p-3.5 rounded-2xl border shadow-xl transition-all cursor-pointer flex items-center justify-center active:scale-95
            ${mapStyle === 'plan'
              ? 'bg-emerald-950/90 border-emerald-800 text-emerald-400 shadow-emerald-500/20'
              : 'bg-zinc-950 border-zinc-800 text-cyan-400 hover:text-white hover:bg-zinc-900 shadow-cyan-500/20'
            }
          `}
          title={
            mapStyle === 'satellite' ? "Vue Plan" : "Vue Satellite"
          }
        >
          <Layers size={18} className={
            mapStyle === 'plan' ? "text-emerald-400 drop-shadow-[0_0_3px_rgba(52,211,153,0.5)]" :
            "text-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.5)]"
          } />
        </button>

        {/* User Geolocation Tracker Button */}
        <button
          onClick={handleFlyToUser}
          className={`
            p-3.5 rounded-2xl border shadow-xl transition-all cursor-pointer flex items-center justify-center active:scale-95
            ${userCoords 
              ? 'bg-sky-500/20 text-sky-400 border-sky-500 shadow-[0_0_10px_rgba(56,189,248,0.3)]' 
              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'
            }
          `}
          title={userCoords ? "Aller à ma position" : "Activer la localisation"}
        >
          <Navigation size={18} className={userCoords ? "rotate-45 text-sky-400 fill-sky-400/20 drop-shadow-[0_0_3px_rgba(56,189,248,0.5)] animate-pulse" : "text-zinc-500"} />
        </button>

      </div>
    </div>
  );
}
