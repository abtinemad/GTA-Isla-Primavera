/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationItem } from '../types';
import { getMarkerHtml } from '../utils/helper';
import { TENERIFE_ROADS } from '../roadsData';
import { ISLAND_RINGS, RELIEF_BANDS, OCEAN_COLOR, LAND_COLOR } from '../geoData';
import { Compass, Navigation, Layers } from 'lucide-react';

interface MapContainerProps {
  locations: LocationItem[];
  selectedLocation: LocationItem | null;
  onSelectLocation: (location: LocationItem) => void;
  userCoords: { lat: number; lng: number } | null;
  onRequestGeolocation: () => void;
  completedLocations?: number[];
}

export default function MapContainer({
  locations,
  selectedLocation,
  onSelectLocation,
  userCoords,
  onRequestGeolocation,
  completedLocations = []
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<number, L.Marker>>({});
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  // Spec §2.1: "Vue Satellite Sombre" is the default base layer.
  const [mapStyle, setMapStyle] = useState<'dark-satellite' | 'gps-vector'>('dark-satellite');
  const tileLayersRef = useRef<L.TileLayer[]>([]);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const vectorLayerRef = useRef<L.LayerGroup | null>(null);

  // Spawn point (QG — Royal Hideaway Corales Villas) used as the route origin
  // when no live GPS fix is available, so the neon track is always visible.
  const SPAWN_ORIGIN = { lat: 28.1026, lng: -16.7483 };

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

    // Dedicated pane for the GPS-vector geometric fills, sitting above the
    // tile pane (200) but below roads/markers so the TF network reads on top.
    map.createPane('landPane');
    const lp = map.getPane('landPane');
    if (lp) lp.style.zIndex = '250';

    // Spec §2.2 — High-Contrast Track: draw the TF network with a hard black
    // casing under an amber (major axes) / crimson (mission roads) top line.
    const roadCasing = L.layerGroup().addTo(map);
    const roadTop = L.layerGroup().addTo(map);
    TENERIFE_ROADS.forEach((seg) => {
      const isMajor = seg.tier === 'major';
      const color = isMajor ? '#E5A93C' : '#C82333';
      const topW = isMajor ? 4.5 : 3.5;
      const casingW = topW + 3;
      L.polyline(seg.path, { color: '#000000', weight: casingW, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(roadCasing);
      L.polyline(seg.path, { color, weight: topW, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false, className: isMajor ? 'tf-road-major' : 'tf-road-mission' }).addTo(roadTop);
    });

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapInstance(null);
    };
  }, []);

  // 1b. Switch base layer: night satellite (raster) vs GPS vector (geometric fills)
  useEffect(() => {
    if (!mapInstance) return;

    // Clear previous base layers (tiles + vector group)
    tileLayersRef.current.forEach(layer => layer.remove());
    tileLayersRef.current = [];
    if (vectorLayerRef.current) {
      vectorLayerRef.current.remove();
      vectorLayerRef.current = null;
    }

    if (mapStyle === 'dark-satellite') {
      // Spec §2.1 — Vue Satellite Sombre (default): real imagery tinted to
      // anthracite/night via CSS filter. Esri imagery carries no commercial
      // POI labels, satisfying the "POI masking".
      const baseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: 'Imagery &copy; Esri', className: 'leaflet-dark-satellite-base'
      }).addTo(mapInstance);
      const roadsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: '', className: 'leaflet-dark-satellite-roads'
      }).addTo(mapInstance);
      tileLayersRef.current = [baseLayer, roadsLayer];

    } else {
      // Spec §2.1 — Vue GPS Vecteur: flat geometric fills (GTA pause-map).
      // Land = pale sage, relief = sand/soft-brown over the real massifs,
      // ocean = navy mask with the island punched out.
      const grp = L.layerGroup();
      const opt = { pane: 'landPane', stroke: false, fillOpacity: 1, interactive: false } as L.PolylineOptions;

      ISLAND_RINGS.forEach((ring) =>
        L.polygon(ring as L.LatLngExpression[], { ...opt, fillColor: LAND_COLOR }).addTo(grp)
      );
      RELIEF_BANDS.forEach((b) =>
        L.polygon(b.ring as L.LatLngExpression[], { ...opt, fillColor: b.color }).addTo(grp)
      );
      const outer: L.LatLngExpression[] = [[27.5, -17.6], [27.5, -15.4], [29.1, -15.4], [29.1, -17.6]];
      L.polygon([outer, ...(ISLAND_RINGS as L.LatLngExpression[][])], { ...opt, fillColor: OCEAN_COLOR }).addTo(grp);
      ISLAND_RINGS.forEach((ring) =>
        L.polygon(ring as L.LatLngExpression[], { pane: 'landPane', fill: false, color: '#3E6285', weight: 1.1, opacity: 0.8, interactive: false }).addTo(grp)
      );

      grp.addTo(mapInstance);
      vectorLayerRef.current = grp;
    }
  }, [mapInstance, mapStyle]);

  // 2. Synchronize user's live position marker
  useEffect(() => {
    const map = mapRef.current;
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
  }, [userCoords]);

  // 3. Render / Update Location Markers on dataset/filter change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    Object.values(markersRef.current).forEach((marker: any) => marker.remove());
    markersRef.current = {};

    // Spawn markers for current visible locations
    locations.forEach((loc) => {
      const isSelected = selectedLocation?.id === loc.id;
      const isCompleted = completedLocations.includes(loc.id);
      
      const customIcon = L.divIcon({
        html: getMarkerHtml(loc.category, isSelected, loc.name, isCompleted),
        className: 'custom-div-icon',
        iconSize: [44, 48],
        iconAnchor: [22, 48],
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
      const isSelected = id === selectedLocation.id;
      const loc = locations.find((l) => l.id === id);
      const isCompleted = completedLocations.includes(id);
      
      if (loc) {
        const updatedIcon = L.divIcon({
          html: getMarkerHtml(loc.category, isSelected, loc.name, isCompleted),
          className: 'custom-div-icon',
          iconSize: [44, 48],
          iconAnchor: [22, 48],
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

  // 5. Active itinerary track (Spec §2.2): a pulsing neon-cyan vector line from
  // the spawn point / live position to the selected target.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    if (selectedLocation) {
      const origin = userCoords ?? SPAWN_ORIGIN;
      const line = L.polyline(
        [
          [origin.lat, origin.lng],
          [selectedLocation.lat, selectedLocation.lng],
        ],
        {
          color: '#00F5D4',
          weight: 4,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
          className: 'neon-route',
        }
      ).addTo(map);
      routeLineRef.current = line;
    }

    return () => {
      if (routeLineRef.current) {
        routeLineRef.current.remove();
        routeLineRef.current = null;
      }
    };
  }, [selectedLocation, userCoords]);
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
      mapStyle === 'dark-satellite' ? 'bg-[#6F9ABE] map-satellite-theme' : 'bg-[#6F9ABE] map-gps-theme'
    }`}>
      
      {/* Map Division Ref */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

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
            setMapStyle(prev => prev === 'dark-satellite' ? 'gps-vector' : 'dark-satellite');
          }}
          className={`
            p-3.5 rounded-2xl border shadow-xl transition-all cursor-pointer flex items-center justify-center active:scale-95
            ${mapStyle === 'gps-vector'
              ? 'bg-emerald-950/90 border-emerald-800 text-emerald-400 shadow-emerald-500/20'
              : 'bg-zinc-950 border-zinc-800 text-cyan-400 hover:text-white hover:bg-zinc-900 shadow-cyan-500/20'
            }
          `}
          title={
            mapStyle === 'dark-satellite' ? "Vue GPS (Vecteur)" : "Vue Satellite (Jour)"
          }
        >
          <Layers size={18} className={
            mapStyle === 'gps-vector' ? "text-emerald-400 drop-shadow-[0_0_3px_rgba(52,211,153,0.5)]" :
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
