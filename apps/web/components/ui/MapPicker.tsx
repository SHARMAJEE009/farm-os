'use client';

import { useEffect, useRef } from 'react';
import type { Map, Marker } from 'leaflet';

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

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onSelect: (lat: number, lng: number) => void;
}

export function MapPicker({ lat, lng, onSelect }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);

  // Initialise the map once on mount
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
        zoom: lat != null ? 11 : 4,
        scrollWheelZoom: false,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

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
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move marker + pan when lat/lng props change (e.g. user typed into the inputs)
  useEffect(() => {
    if (!mapRef.current || lat == null || lng == null) return;

    import('leaflet').then((L) => {
      if (!mapRef.current) return;
      const icon = L.divIcon({ className: '', html: PIN_HTML, iconSize: [0, 0] });

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { icon }).addTo(mapRef.current);
      }

      mapRef.current.flyTo([lat, lng], 11, { duration: 0.8 });
    });
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      className="rounded-xl overflow-hidden border border-gray-200 cursor-crosshair"
      style={{ height: 220 }}
    />
  );
}
