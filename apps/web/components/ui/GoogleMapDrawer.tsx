'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDczpKdbpfzdHUXwcp-wqjTxoNcYAse0is'; // Reuse existing key

let gmapsLoaded = false;
let gmapsCallbacks: Array<() => void> = [];

function loadGoogleMaps(cb: () => void) {
  if (gmapsLoaded) { cb(); return; }
  gmapsCallbacks.push(cb);
  if (document.getElementById('gm-script')) return;

  const script = document.createElement('script');
  script.id = 'gm-script';
  // Include places and drawing libraries
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,drawing`;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    gmapsLoaded = true;
    gmapsCallbacks.forEach(fn => fn());
    gmapsCallbacks = [];
  };
  document.head.appendChild(script);
}

export type LatLngTuple = [number, number]; // [lng, lat] for GeoJSON

export interface DrawnPolygon {
  id: string;
  name: string;
  type: 'farm' | 'paddock';
  coords: LatLngTuple[]; // [lng, lat]
  area_ha: number;
}

interface GoogleMapDrawerProps {
  onPolygonsChange: (polygons: DrawnPolygon[]) => void;
  height?: number | string;
}

export function GoogleMapDrawer({ onPolygonsChange, height = 500 }: GoogleMapDrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const [ready, setReady] = useState(false);
  const [mapMode, setMapMode] = useState<'hybrid' | 'roadmap'>('hybrid');
  
  const polygonsRef = useRef<{ id: string; poly: google.maps.Polygon; data: DrawnPolygon }[]>([]);

  // Poly area calculation
  const calculateAreaHa = (path: google.maps.MVCArray<google.maps.LatLng>) => {
    const areaSqMeters = google.maps.geometry.spherical.computeArea(path);
    return areaSqMeters / 10000;
  };

  const getGeoJsonCoords = (path: google.maps.MVCArray<google.maps.LatLng>): LatLngTuple[] => {
    const coords: LatLngTuple[] = [];
    for (let i = 0; i < path.getLength(); i++) {
      const pt = path.getAt(i);
      coords.push([parseFloat(pt.lng().toFixed(6)), parseFloat(pt.lat().toFixed(6))]);
    }
    return coords;
  };

  const notifyChange = () => {
    onPolygonsChange(polygonsRef.current.map(p => p.data));
  };

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;
    const g = window.google.maps;

    const map = new g.Map(containerRef.current, {
      center: { lat: -25.2744, lng: 133.7751 },
      zoom: 4,
      mapTypeId: 'hybrid',
      mapTypeControlOptions: { mapTypeIds: [] },
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      gestureHandling: 'cooperative',
    });
    mapRef.current = map;

    // Search Box
    if (searchInputRef.current) {
      const searchBox = new g.places.SearchBox(searchInputRef.current);
      map.controls[g.ControlPosition.TOP_LEFT].push(searchInputRef.current);

      searchBox.addListener('places_changed', () => {
        const places = searchBox.getPlaces();
        if (!places || places.length === 0) return;
        const bounds = new g.LatLngBounds();
        places.forEach(place => {
          if (!place.geometry || !place.geometry.location) return;
          if (place.geometry.viewport) {
            bounds.union(place.geometry.viewport);
          } else {
            bounds.extend(place.geometry.location);
          }
        });
        map.fitBounds(bounds);
      });
    }

    // Drawing Manager
    const drawingManager = new g.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: true,
      drawingControlOptions: {
        position: g.ControlPosition.TOP_CENTER,
        drawingModes: [g.drawing.OverlayType.POLYGON],
      },
      polygonOptions: {
        fillColor: '#16a34a',
        fillOpacity: 0.3,
        strokeColor: '#16a34a',
        strokeWeight: 2,
        editable: true,
        zIndex: 1,
      },
    });
    drawingManager.setMap(map);
    drawingManagerRef.current = drawingManager;

    g.event.addListener(drawingManager, 'overlaycomplete', (event: any) => {
      if (event.type === g.drawing.OverlayType.POLYGON) {
        const poly = event.overlay as google.maps.Polygon;
        drawingManager.setDrawingMode(null); // Stop drawing after one polygon

        const path = poly.getPath();
        const area_ha = calculateAreaHa(path);
        const coords = getGeoJsonCoords(path);
        
        // Determine type based on existing polygons. First one is usually farm.
        const isFirst = polygonsRef.current.length === 0;
        const type = isFirst ? 'farm' : 'paddock';
        const name = isFirst ? 'Farm Boundary' : `Paddock ${polygonsRef.current.length}`;

        const newPolyData: DrawnPolygon = {
          id: Math.random().toString(36).substr(2, 9),
          name,
          type,
          coords,
          area_ha: parseFloat(area_ha.toFixed(2))
        };

        // Color difference
        if (type === 'farm') {
          poly.setOptions({ strokeColor: '#eab308', fillColor: '#eab308' }); // Yellow for farm
        }

        polygonsRef.current.push({ id: newPolyData.id, poly, data: newPolyData });
        notifyChange();

        // Listen for edits
        ['set_at', 'insert_at', 'remove_at'].forEach(eventName => {
          g.event.addListener(path, eventName, () => {
            const updatedArea = calculateAreaHa(poly.getPath());
            const updatedCoords = getGeoJsonCoords(poly.getPath());
            const pObj = polygonsRef.current.find(p => p.id === newPolyData.id);
            if (pObj) {
              pObj.data.area_ha = parseFloat(updatedArea.toFixed(2));
              pObj.data.coords = updatedCoords;
              notifyChange();
            }
          });
        });
        
        // Right click to remove
        g.event.addListener(poly, 'rightclick', () => {
          if (confirm('Delete this polygon?')) {
            poly.setMap(null);
            polygonsRef.current = polygonsRef.current.filter(p => p.id !== newPolyData.id);
            notifyChange();
          }
        });
      }
    });

    setReady(true);
  }, [onPolygonsChange]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadGoogleMaps(initMap);
  }, [initMap]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setMapTypeId(mapMode);
  }, [mapMode]);

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

      {/* Hidden input used by Google Maps API for Places SearchBox */}
      <input
        ref={searchInputRef}
        type="text"
        placeholder="Search for location..."
        className="mt-2 ml-2 px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-farm-500 w-64 absolute top-0 left-0 z-10"
        style={{ display: ready ? 'block' : 'none' }}
      />

      <div ref={containerRef} className="absolute inset-0" />

      {/* Map Mode toggle */}
      <div className="absolute bottom-6 right-2 z-[5] flex rounded-lg overflow-hidden shadow-md border border-gray-200">
        {([['hybrid', 'Satellite'], ['roadmap', 'Street']] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setMapMode(mode)}
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
