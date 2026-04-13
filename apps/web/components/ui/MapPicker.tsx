'use client';

import { useEffect, useRef } from 'react';
import type { Map, Marker, Polygon } from 'leaflet';

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

export function MapPicker({ lat, lng, onSelect, kmlBoundary }: MapPickerProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<Map | null>(null);
  const markerRef     = useRef<Marker | null>(null);
  const polygonRef    = useRef<Polygon | null>(null);

  // ── Initialise map once ─────────────────────────────────────
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
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Initial marker
      if (lat != null && lng != null) {
        markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
      }

      // Click to place / move pin
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

      // Draw boundary if already provided on mount
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
        polygonRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Move marker when lat/lng props change (typed in fields) ─
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

      // Only pan if no boundary is already shown
      if (!polygonRef.current) {
        mapRef.current.flyTo([lat, lng], 12, { duration: 0.8 });
      }
    });
  }, [lat, lng]);

  // ── Draw / update boundary when kmlBoundary prop changes ───
  useEffect(() => {
    if (!mapRef.current || !kmlBoundary || kmlBoundary.length < 3) return;

    import('leaflet').then((L) => {
      if (!mapRef.current) return;
      const icon = L.divIcon({ className: '', html: PIN_HTML, iconSize: [0, 0] });
      drawBoundary(L, mapRef.current, kmlBoundary, icon);
    });
  }, [kmlBoundary]);

  return (
    <div
      ref={containerRef}
      className="rounded-xl overflow-hidden border border-gray-200 cursor-crosshair"
      style={{ height: 260 }}
    />
  );
}

// ── Helper: draw polygon + centroid marker, fit map to bounds ──
function drawBoundary(
  L: typeof import('leaflet'),
  map: import('leaflet').Map,
  boundary: LatLngTuple[],
  icon: import('leaflet').DivIcon,
) {
  // Remove old polygon
  if ((map as any)._kmlPolygon) {
    (map as any)._kmlPolygon.remove();
  }
  if ((map as any)._kmlMarker) {
    (map as any)._kmlMarker.remove();
  }

  // GeoJSON is [lng, lat] — Leaflet expects [lat, lng]
  const latlngs = boundary.map(([lng, lat]) => [lat, lng] as [number, number]);

  const polygon = L.polygon(latlngs, {
    color: '#16a34a',
    weight: 2.5,
    fillColor: '#16a34a',
    fillOpacity: 0.15,
  }).addTo(map);

  (map as any)._kmlPolygon = polygon;

  // Centroid of bounding box
  const bounds = polygon.getBounds();
  const center = bounds.getCenter();

  const marker = L.marker([center.lat, center.lng], { icon }).addTo(map);
  (map as any)._kmlMarker = marker;

  map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
}
