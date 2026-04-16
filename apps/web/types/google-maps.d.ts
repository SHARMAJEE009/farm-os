// Minimal Google Maps type declarations to avoid installing @types/google.maps
// These cover only the APIs used in GoogleMapPicker.tsx

declare namespace google {
  namespace maps {
    class Map {
      constructor(el: HTMLElement, opts?: MapOptions);
      setMapTypeId(id: string): void;
      panTo(pos: LatLngLiteral): void;
      fitBounds(bounds: LatLngBounds, padding?: number): void;
      addListener(event: string, handler: (e: MapMouseEvent) => void): void;
    }
    class Marker {
      constructor(opts?: MarkerOptions);
      setPosition(pos: LatLngLiteral): void;
      setMap(map: Map | null): void;
    }
    class Polygon {
      constructor(opts?: PolygonOptions);
      setMap(map: Map | null): void;
    }
    class LatLngBounds {
      extend(pos: LatLngLiteral): void;
    }
    interface MapOptions {
      center?: LatLngLiteral;
      zoom?: number;
      mapTypeId?: string;
      mapTypeControlOptions?: { mapTypeIds: string[] };
      streetViewControl?: boolean;
      fullscreenControl?: boolean;
      zoomControl?: boolean;
      gestureHandling?: string;
    }
    interface MarkerOptions {
      position?: LatLngLiteral;
      map?: Map;
      icon?: Symbol | string;
    }
    interface PolygonOptions {
      paths?: LatLngLiteral[];
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      fillColor?: string;
      fillOpacity?: number;
      map?: Map;
    }
    interface LatLngLiteral {
      lat: number;
      lng: number;
    }
    interface MapMouseEvent {
      latLng: { lat(): number; lng(): number } | null;
    }
    interface Symbol {
      path: SymbolPath;
      scale?: number;
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeWeight?: number;
    }
    enum SymbolPath {
      CIRCLE = 0,
    }
  }
}

interface Window {
  google: typeof google;
}
