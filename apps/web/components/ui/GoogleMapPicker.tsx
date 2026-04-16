'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDczpKdbpfzdHUXwcp-wqjTxoNcYAse0is';

/** [lng, lat] pairs — same GeoJSON convention as the existing KML parser */
export type LatLngTuple = [number, number];

export interface KmlPlacemark {
  name: string | null;
  description: string | null;
  coords: LatLngTuple[];
  centroid: { lat: number; lng: number };
  area_ha: number | null;
}

interface GoogleMapPickerProps {
  lat: number | null;
  lng: number | null;
  onSelect: (lat: number, lng: number) => void;
  /** KML boundary polygon (GeoJSON [lng,lat] tuples) */
  kmlBoundary?: LatLngTuple[] | null;
}

type MapMode = 'satellite' | 'roadmap' | 'hybrid';

// ── Load Google Maps script once, globally ──────────────────────────────────
let gmapsLoaded = false;
let gmapsCallbacks: Array<() => void> = [];

function loadGoogleMaps(cb: () => void) {
  if (gmapsLoaded) { cb(); return; }
  gmapsCallbacks.push(cb);
  if (document.getElementById('gm-script')) return;  // already loading

  const script = document.createElement('script');
  script.id = 'gm-script';
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    gmapsLoaded = true;
    gmapsCallbacks.forEach(fn => fn());
    gmapsCallbacks = [];
  };
  document.head.appendChild(script);
}

// ── Area calc (same as existing KML parser) ──────────────────────────────────
function polygonAreaHa(coords: LatLngTuple[]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[(i + 1) % n];
    area += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((area * R * R) / 2) / 10_000;
}

// ── Multi-placemark KML parser ───────────────────────────────────────────────
export function parseKmlMulti(text: string): KmlPlacemark[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid KML file — could not parse XML.');

  const placemarks = Array.from(doc.querySelectorAll('Placemark'));
  if (placemarks.length === 0) throw new Error('No Placemarks found in KML file.');

  return placemarks.map((pm) => {
    const name = pm.querySelector('name')?.textContent?.trim() ?? null;
    const description = pm.querySelector('description')?.textContent?.trim() ?? null;

    const coordsEl =
      pm.querySelector('Polygon outerBoundaryIs coordinates') ??
      pm.querySelector('Polygon coordinates') ??
      pm.querySelector('LinearRing coordinates') ??
      pm.querySelector('LineString coordinates') ??
      pm.querySelector('coordinates');

    if (!coordsEl?.textContent) {
      return { name, description, coords: [], centroid: { lat: 0, lng: 0 }, area_ha: null };
    }

    const tuples = coordsEl.textContent.trim().split(/\s+/).filter(Boolean);
    const coords: LatLngTuple[] = tuples
      .map(t => {
        const parts = t.split(',').map(Number);
        if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
        return [parts[0], parts[1]] as LatLngTuple;
      })
      .filter((c): c is LatLngTuple => c !== null);

    if (coords.length === 0) {
      return { name, description, coords: [], centroid: { lat: 0, lng: 0 }, area_ha: null };
    }

    const lngs = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    const centroid = {
      lat: parseFloat(((Math.min(...lats) + Math.max(...lats)) / 2).toFixed(6)),
      lng: parseFloat(((Math.min(...lngs) + Math.max(...lngs)) / 2).toFixed(6)),
    };
    const area_ha = coords.length >= 3 ? parseFloat(polygonAreaHa(coords).toFixed(2)) : null;

    return { name, description, coords, centroid, area_ha };
  }).filter(pm => pm.coords.length > 0);
}

// ── Farm-level KML parser ────────────────────────────────────────────────────
export interface FarmKmlData {
  farmName: string | null;
  description: string | null;
  totalAreaHa: number;
  placemarks: KmlPlacemark[];
}

/**
 * Parse a KML file and extract both farm-level metadata and all paddock placemarks.
 * Farm name is read from <Document><name> or the first <Folder><name>.
 * Total area is the sum of all placemark polygon areas.
 */
export function parseFarmKml(text: string): FarmKmlData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid KML file — could not parse XML.');

  // Farm name: prefer Document > name, fall back to first Folder > name
  const docName = doc.querySelector('Document > name')?.textContent?.trim() ?? null;
  const folderName = doc.querySelector('Folder > name')?.textContent?.trim() ?? null;
  const farmName = docName || folderName;

  const description = doc.querySelector('Document > description')?.textContent?.trim() ?? null;

  const placemarks = parseKmlMulti(text);
  const totalAreaHa = parseFloat(
    placemarks.reduce((sum, p) => sum + (p.area_ha ?? 0), 0).toFixed(2)
  );

  return { farmName, description, totalAreaHa, placemarks };
}

// ── Colour palette for multi-paddock map ────────────────────────────────────
const POLY_PALETTE = [
  '#ef4444', '#3b82f6', '#f97316', '#a855f7', '#06b6d4',
  '#eab308', '#ec4899', '#22c55e', '#f43f5e', '#14b8a6',
];

export interface MapPaddock {
  id?: string;
  name: string;
  boundary_geojson?: { type: string; coordinates: number[][][] } | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Shows all paddock boundaries as distinct coloured polygons with centroid labels.
 * Accepts either saved DB paddocks (boundary_geojson) or raw KML placemarks (for preview).
 */
export function FarmPaddockMap({
  paddocks = [],
  placemarks,
  onPaddockClick,
  height = 500,
}: {
  paddocks?: MapPaddock[];
  placemarks?: KmlPlacemark[];
  onPaddockClick?: (id: string) => void;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<google.maps.Map | null>(null);
  const drawRef      = useRef<(google.maps.Polygon | google.maps.Marker)[]>([]);
  const [mapMode, setMapMode] = useState<MapMode>('hybrid');
  const [ready, setReady]     = useState(false);

  // Unify both paddocks and placemarks into a single shape
  const items = (() => {
    if (placemarks) {
      return placemarks.map((p, i) => ({
        id: String(i),
        name: p.name ?? `Paddock ${i + 1}`,
        path: p.coords.map(([lng, lat]) => ({ lat, lng })),
        centroid: p.centroid,
      }));
    }
    return paddocks.map(p => {
      const raw = (p.boundary_geojson as any)?.coordinates?.[0] as LatLngTuple[] | undefined;
      const path = raw?.map(([lng, lat]) => ({ lat, lng })) ?? [];
      const centroid = p.latitude != null && p.longitude != null
        ? { lat: p.latitude, lng: p.longitude }
        : path.length > 0
          ? {
              lat: path.reduce((s, pt) => s + pt.lat, 0) / path.length,
              lng: path.reduce((s, pt) => s + pt.lng, 0) / path.length,
            }
          : null;
      return { id: p.id ?? '', name: p.name, path, centroid };
    });
  })();

  // Initialise map once
  useEffect(() => {
    loadGoogleMaps(() => {
      if (!containerRef.current || mapRef.current) return;
      const g = window.google.maps;
      mapRef.current = new g.Map(containerRef.current, {
        center: { lat: -25.2744, lng: 133.7751 },
        zoom: 5,
        mapTypeId: 'hybrid',
        mapTypeControlOptions: { mapTypeIds: [] },
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
      });
      setReady(true);
    });
    return () => {
      drawRef.current.forEach(d => d.setMap(null));
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mapRef.current) mapRef.current.setMapTypeId(mapMode);
  }, [mapMode]);

  // Redraw whenever data changes
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = window.google.maps;
    const map = mapRef.current;

    drawRef.current.forEach(d => d.setMap(null));
    drawRef.current = [];

    const bounds = new g.LatLngBounds();
    let hasData = false;

    items.forEach((item, idx) => {
      const color = POLY_PALETTE[idx % POLY_PALETTE.length];

      if (item.path.length >= 3) {
        const poly = new g.Polygon({
          paths: item.path,
          strokeColor: color,
          strokeOpacity: 1,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.28,
          map,
          zIndex: 1,
        });
        if (onPaddockClick && item.id) {
          poly.addListener('click', () => onPaddockClick(item.id!));
        }
        drawRef.current.push(poly);
        item.path.forEach(pt => bounds.extend(pt));
        hasData = true;
      }

      if (item.centroid) {
        if (item.path.length === 0) { bounds.extend(item.centroid); hasData = true; }
        const marker = new g.Marker({
          position: item.centroid,
          map,
          label: { text: item.name, color: '#ffffff', fontSize: '11px', fontWeight: 'bold' },
          icon: { path: g.SymbolPath.CIRCLE, scale: 0, fillOpacity: 0, strokeOpacity: 0 },
          zIndex: 3,
        });
        if (onPaddockClick && item.id) {
          marker.addListener('click', () => onPaddockClick(item.id!));
        }
        drawRef.current.push(marker);
      }
    });

    if (hasData) map.fitBounds(bounds, 48);
  }, [ready, items, onPaddockClick]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200" style={{ height }}>
      {!ready && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-farm-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-400">Loading map…</p>
          </div>
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute top-2 right-2 z-[5] flex rounded-lg overflow-hidden shadow-md border border-gray-200">
        {([['hybrid', 'Satellite'], ['roadmap', 'Street']] as [MapMode, string][]).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setMapMode(mode as MapMode)}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              mapMode === mode ? 'bg-farm-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            } ${mode === 'roadmap' ? 'border-l border-gray-200' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
export function GoogleMapPicker({ lat, lng, onSelect, kmlBoundary }: GoogleMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<google.maps.Map | null>(null);
  const markerRef    = useRef<google.maps.Marker | null>(null);
  const polygonRef   = useRef<google.maps.Polygon | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>('hybrid');
  const [ready, setReady] = useState(false);

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;
    const g = window.google.maps;

    const center = lat != null && lng != null
      ? { lat, lng }
      : { lat: -25.2744, lng: 133.7751 };

    const map = new g.Map(containerRef.current, {
      center,
      zoom: lat != null ? 13 : 4,
      mapTypeId: 'hybrid',
      mapTypeControlOptions: { mapTypeIds: [] },
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      gestureHandling: 'cooperative',
    });

    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      const clickLat = parseFloat(e.latLng!.lat().toFixed(6));
      const clickLng = parseFloat(e.latLng!.lng().toFixed(6));

      if (markerRef.current) {
        markerRef.current.setPosition({ lat: clickLat, lng: clickLng });
      } else {
        markerRef.current = new g.Marker({
          position: { lat: clickLat, lng: clickLng },
          map,
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#16a34a',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2.5,
          },
        });
      }
      onSelect(clickLat, clickLng);
    });

    if (lat != null && lng != null) {
      markerRef.current = new g.Marker({
        position: { lat, lng },
        map,
        icon: {
          path: g.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#16a34a',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2.5,
        },
      });
    }

    mapRef.current = map;
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load Google Maps script on mount
  useEffect(() => {
    loadGoogleMaps(initMap);
    return () => {
      if (markerRef.current)  { markerRef.current.setMap(null);  markerRef.current = null; }
      if (polygonRef.current) { polygonRef.current.setMap(null); polygonRef.current = null; }
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch map type
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setMapTypeId(mapMode);
  }, [mapMode]);

  // Move marker when lat/lng props change
  useEffect(() => {
    if (!mapRef.current || !ready || lat == null || lng == null) return;
    const g = window.google.maps;
    const pos = { lat, lng };
    if (markerRef.current) {
      markerRef.current.setPosition(pos);
    } else {
      markerRef.current = new g.Marker({
        position: pos,
        map: mapRef.current,
        icon: {
          path: g.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#16a34a',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2.5,
        },
      });
    }
    if (!polygonRef.current) {
      mapRef.current.panTo(pos);
    }
  }, [lat, lng, ready]);

  // Draw / update KML polygon boundary
  useEffect(() => {
    if (!mapRef.current || !ready || !kmlBoundary || kmlBoundary.length < 3) return;
    const g = window.google.maps;

    if (polygonRef.current) polygonRef.current.setMap(null);

    // GeoJSON is [lng,lat] — Google Maps expects {lat,lng}
    const path = kmlBoundary.map(([lngVal, latVal]) => ({ lat: latVal, lng: lngVal }));

    polygonRef.current = new g.Polygon({
      paths: path,
      strokeColor: '#16a34a',
      strokeOpacity: 0.9,
      strokeWeight: 2.5,
      fillColor: '#16a34a',
      fillOpacity: 0.15,
      map: mapRef.current,
    });

    // Fit map to polygon bounds
    const bounds = new g.LatLngBounds();
    path.forEach(p => bounds.extend(p));
    mapRef.current.fitBounds(bounds, 32);
  }, [kmlBoundary, ready]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200" style={{ height: 300 }}>
      {/* Loading state */}
      {!ready && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-farm-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-400">Loading map…</p>
          </div>
        </div>
      )}

      {/* Map container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Layer toggle */}
      <div className="absolute top-2 right-2 z-[5] flex rounded-lg overflow-hidden shadow-md border border-gray-200">
        {([['hybrid', 'Satellite'], ['roadmap', 'Street']] as [MapMode, string][]).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setMapMode(mode)}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              mapMode === mode
                ? 'bg-farm-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            } ${mode === 'roadmap' ? 'border-l border-gray-200' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
