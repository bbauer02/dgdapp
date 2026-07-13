"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

export interface GeoPoint {
  lat: number;
  lng: number;
}

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

const FRANCE_CENTER: [number, number] = [46.6, 2.4];

function formatPos(p: GeoPoint | null | undefined): string {
  return p ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : "";
}

/** "48.85, 2.35" / "48.85; 2.35" / "48.85 2.35" → GeoPoint, else null. */
function parseCoords(raw: string): GeoPoint | null {
  const m = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/**
 * "Lieu" field with geocoding (OpenStreetMap Nominatim) and a dark Leaflet
 * map. Accepts a locality name OR raw "lat, lng" GPS coordinates; the marker
 * is draggable and the map clickable to fine-tune the position. Submits
 * `location` (text) plus hidden `latitude` / `longitude` fields.
 */
export default function LocationPicker({
  inputClass,
  defaultLocation,
  defaultPosition,
}: {
  inputClass: string;
  defaultLocation?: string;
  defaultPosition?: GeoPoint | null;
}) {
  const [location, setLocation] = useState(defaultLocation ?? "");
  const [pos, setPos] = useState<GeoPoint | null>(defaultPosition ?? null);
  // Editable mirror of `pos` — map click/drag writes it, typing coords moves the marker.
  const [gpsText, setGpsText] = useState(formatPos(defaultPosition));
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const mapEl = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markerRef = useRef<Leaflet.Marker | null>(null);
  // Latest `location` for map-event closures (registered once at init).
  const locationRef = useRef(location);
  locationRef.current = location;

  /** Reverse-geocode a point into "Lieu" — only when the field is empty,
   *  so a hand-written label is never clobbered by a map click. */
  async function reverseFill(p: GeoPoint) {
    if (locationRef.current.trim()) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}&accept-language=fr`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data?.display_name) setLocation(data.display_name);
    } catch {
      // Lieu stays empty — the coordinates alone are still valid.
    }
  }

  function placePoint(p: GeoPoint) {
    setPos(p);
    reverseFill(p);
  }

  // Leaflet touches `window` at import time — load it client-side only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(mapEl.current).setView(
        pos ? [pos.lat, pos.lng] : FRANCE_CENTER,
        pos ? 13 : 5
      );
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);
      map.on("click", (e: Leaflet.LeafletMouseEvent) =>
        placePoint({ lat: e.latlng.lat, lng: e.latlng.lng })
      );
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker in sync with the position.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!pos) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const icon = L.divIcon({
        className: "",
        html: '<span class="map-pin"></span>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const marker = L.marker([pos.lat, pos.lng], { icon, draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        placePoint({ lat: ll.lat, lng: ll.lng });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng([pos.lat, pos.lng]);
    }
    map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 12));
  }, [pos, mapReady]);

  // Marker moved (click, drag, search) → refresh the GPS field.
  useEffect(() => {
    setGpsText(formatPos(pos));
  }, [pos]);

  function applyGps() {
    const raw = gpsText.trim();
    if (!raw) {
      setPos(null);
      return;
    }
    const coords = parseCoords(raw);
    if (coords) {
      setNotice(null);
      placePoint(coords);
    } else {
      setNotice("Coordonnées invalides — format attendu : « 48.85, 2.35 ».");
    }
  }

  function pick(r: NominatimResult) {
    setLocation(r.display_name);
    setPos({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
    setResults([]);
    setNotice(null);
  }

  async function search() {
    const q = location.trim();
    if (!q) return;
    setNotice(null);
    setResults([]);

    // Raw GPS coordinates skip the geocoder entirely.
    const coords = parseCoords(q);
    if (coords) {
      setPos(coords);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=fr&q=${encodeURIComponent(q)}`
      );
      if (!res.ok) throw new Error(String(res.status));
      const data: NominatimResult[] = await res.json();
      if (data.length === 0) setNotice("Aucun lieu trouvé.");
      else if (data.length === 1) pick(data[0]);
      else setResults(data);
    } catch {
      setNotice("Recherche indisponible — réessayez, ou placez le repère sur la carte.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="stat-label">Lieu</span>
      <div className="flex gap-2">
        <input
          name="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder="Localité ou adresse"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className="btn btn-ghost shrink-0 !px-4 !py-2 disabled:opacity-60"
        >
          {searching ? "…" : "Localiser"}
        </button>
      </div>

      {notice && <p className="font-nav text-xs text-ink-soft">{notice}</p>}

      {results.length > 0 && (
        <ul className="panel divide-y divide-hair">
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="block w-full px-3 py-2 text-left font-nav text-xs text-ink-soft transition hover:bg-surface-raised hover:text-white"
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div ref={mapEl} className="h-64 w-full border border-hair" />

      <div className="mt-1 flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="stat-label">Coordonnées GPS</span>
          <input
            value={gpsText}
            onChange={(e) => setGpsText(e.target.value)}
            onBlur={applyGps}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyGps();
              }
            }}
            placeholder="Cliquez sur la carte, ou « 48.85, 2.35 »"
            className={inputClass}
          />
        </label>
        {pos && (
          <button
            type="button"
            onClick={() => setPos(null)}
            className="shrink-0 pb-2 font-nav text-[0.65rem] uppercase tracking-wider text-ink-faint transition hover:text-danger"
          >
            Retirer le repère
          </button>
        )}
      </div>
      <p className="font-nav text-[0.65rem] uppercase tracking-wider text-ink-faint">
        {pos
          ? "Repère déplaçable — un clic sur la carte remplit aussi le lieu s'il est vide."
          : "Recherchez un lieu ou cliquez sur la carte pour placer le repère."}
      </p>

      <input type="hidden" name="latitude" value={pos?.lat ?? ""} />
      <input type="hidden" name="longitude" value={pos?.lng ?? ""} />
    </div>
  );
}
