'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map, Marker, Polygon, TileLayer } from 'leaflet';

const PIN_HTML = `
  <div style="
    width:22px;height:22px;
    background:#16a34a;
    border:3px solid white;
    border-radius:50%;
    box-shadow:0 2px 8px rgba(0,0,0,0.4);
    position:relative;
    top:-11px;left:-11px;
  "></div>`;

/** [lng, lat] pairs — same order as GeoJSON */
export type LatLngTuple = [number, number];

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onSelect: (lat: number, lng: number) => void;
  /** Optional polygon boundary from a KML/GeoJSON import */
  kmlBoundary?: LatLngTuple[] | null;
}

type LayerMode = 'street' | 'satellite';

const TILE_LAYERS: Record<LayerMode, { url: string; attribution: string }> = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, USDA FSA, USGS, Aerogrid, IGN, IGP, and the GIS User Community',
  },
};

// ── Helper: draw polygon + centroid marker, fit map to bounds ──
function drawBoundary(
  L: typeof import('leaflet'),
  map: import('leaflet').Map,
  boundary: LatLngTuple[],
  icon: import('leaflet').DivIcon,
) {
  if ((map as any)._kmlPolygon) (map as any)._kmlPolygon.remove();
  if ((map as any)._kmlMarker)  (map as any)._kmlMarker.remove();

  // GeoJSON is [lng, lat] — Leaflet expects [lat, lng]
  const latlngs = boundary.map(([lng, lat]) => [lat, lng] as [number, number]);

  const polygon = L.polygon(latlngs, {
    color: '#16a34a',
    weight: 2.5,
    fillColor: '#16a34a',
    fillOpacity: 0.15,
  }).addTo(map);
  (map as any)._kmlPolygon = polygon;

  const bounds = polygon.getBounds();
  const center = bounds.getCenter();
  const marker = L.marker([center.lat, center.lng], { icon }).addTo(map);
  (map as any)._kmlMarker = marker;

  map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
}

export function MapPicker({ lat, lng, onSelect, kmlBoundary }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<Map | null>(null);
  const markerRef    = useRef<Marker | null>(null);
  const tileRef      = useRef<TileLayer | null>(null);

  const [mode, setMode] = useState<LayerMode>('street');

  // ── Initialise map once ──────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const icon = L.divIcon({ className: '', html: PIN_HTML, iconSize: [0, 0] });

      const center: [number, number] =
        lat != null && lng != null ? [lat, lng] : [-25.2744, 133.7751];

      const map = L.map(containerRef.current, {
        center,
        zoom: lat != null ? 12 : 4,
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });

      const { url, attribution } = TILE_LAYERS.street;
      tileRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map);

      if (lat != null && lng != null) {
        markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
      }

      map.on('click', (e) => {
        const clickLat = parseFloat(e.latlng.lat.toFixed(6));
        const clickLng = parseFloat(e.latlng.lng.toFixed(6));
        if (markerRef.current) {
          markerRef.current.setLatLng([clickLat, clickLng]);
        } else {
          markerRef.current = L.marker([clickLat, clickLng], { icon }).addTo(map);
        }
        onSelect(clickLat, clickLng);
      });

      mapRef.current = map;

      if (kmlBoundary && kmlBoundary.length >= 3) {
        drawBoundary(L, map, kmlBoundary, icon);
      }
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        tileRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Swap tile layer when mode changes ────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;

    import('leaflet').then((L) => {
      if (!mapRef.current) return;

      if (tileRef.current) {
        tileRef.current.remove();
      }

      const { url, attribution } = TILE_LAYERS[mode];
      tileRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(mapRef.current!);

      // Bring KML polygon back on top after tile swap
      if ((mapRef.current as any)._kmlPolygon) {
        (mapRef.current as any)._kmlPolygon.bringToFront();
      }
    });
  }, [mode]);

  // ── Move marker when lat/lng props change ────────────────────
  useEffect(() => {
    if (!mapRef.current || lat == null || lng == null) return;

    import('leaflet').then((L) => {
      if (!mapRef.current) return;
      const icon = L.divIcon({ className: '', html: PIN_HTML, iconSize: [0, 0] });

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { icon }).addTo(mapRef.current!);
      }

      if (!(mapRef.current as any)._kmlPolygon) {
        mapRef.current.flyTo([lat, lng], 12, { duration: 0.8 });
      }
    });
  }, [lat, lng]);

  // ── Draw / update boundary when kmlBoundary prop changes ─────
  useEffect(() => {
    if (!mapRef.current || !kmlBoundary || kmlBoundary.length < 3) return;

    import('leaflet').then((L) => {
      if (!mapRef.current) return;
      const icon = L.divIcon({ className: '', html: PIN_HTML, iconSize: [0, 0] });
      drawBoundary(L, mapRef.current, kmlBoundary, icon);
    });
  }, [kmlBoundary]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200" style={{ height: 260 }}>
      {/* Map container */}
      <div ref={containerRef} className="absolute inset-0 cursor-crosshair" />

      {/* Layer toggle — top-right, above Leaflet controls */}
      <div className="absolute top-2 right-2 z-[1000] flex rounded-lg overflow-hidden shadow-md border border-gray-200">
        <button
          type="button"
          onClick={() => setMode('street')}
          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
            mode === 'street'
              ? 'bg-farm-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Street
        </button>
        <button
          type="button"
          onClick={() => setMode('satellite')}
          className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-gray-200 ${
            mode === 'satellite'
              ? 'bg-farm-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Satellite
        </button>
      </div>
    </div>
  );
}
