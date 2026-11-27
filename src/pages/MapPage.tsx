import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { AqiStatusIndicator } from '../components/AqiStatusBadge.tsx';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import { useLocationPresets } from '../hooks/useLocationPresets.ts';
import { interpretAqi } from '../utils/aqi.ts';

interface MapPageProps {
  state: BreatheWiseState;
  onOpenLocationModal: () => void;
}

export function MapPage({ state, onOpenLocationModal }: MapPageProps) {
  const { location, setLocation, snapshot } = state;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const initialCoordsRef = useRef<[number, number]>([
    location.latitude,
    location.longitude,
  ]);
  const { presets } = useLocationPresets(true);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: initialCoordsRef.current,
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = Number(e.latlng.lat.toFixed(4));
      const lon = Number(e.latlng.lng.toFixed(4));
      setLocation({
        id: `map-pin-${lat}-${lon}`,
        name: `Selected Map Point`,
        neighborhood: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
        country: 'Custom Coordinates',
        countryCode: lat >= 6 && lat <= 37 && lon >= 68 && lon <= 98 ? 'IN' : 'XX',
        latitude: lat,
        longitude: lon,
        source: 'search',
      });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerLayerRef.current = null;
    };
  }, [setLocation]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;

    map.setView([location.latitude, location.longitude], 11, {
      animate: true,
    });
    layer.clearLayers();

    const aqiColor = interpretAqi(snapshot?.aqi, snapshot?.aqiScale ?? 'US_EPA').hexColor;

    // Active location circle marker
    const activeMarker = L.circleMarker([location.latitude, location.longitude], {
      radius: 12,
      fillColor: aqiColor,
      color: '#18543F',
      weight: 2.5,
      opacity: 1,
      fillOpacity: 0.85,
    });
    activeMarker.bindPopup(
      `<strong>${location.name}</strong><br/>AQI: ${
        snapshot?.aqi ?? 'Unavailable'
      } (${interpretAqi(snapshot?.aqi, snapshot?.aqiScale ?? 'US_EPA').label})`,
    );
    activeMarker.addTo(layer);

    // Preset reference city markers
    presets.forEach((p) => {
      if (p.id === location.id) return;
      const m = L.circleMarker([p.latitude, p.longitude], {
        radius: 7,
        fillColor: '#5B9CCB',
        color: '#20332B',
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.7,
      });
      m.bindTooltip(`${p.name}${p.neighborhood ? ` (${p.neighborhood})` : ''}`);
      m.on('click', () => setLocation(p));
      m.addTo(layer);
    });
  }, [location, snapshot, presets, setLocation]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#20332B]">
            Air Quality Map
          </h1>
          <p className="text-sm text-[#66786E] mt-1">
            Inspect your current area, click any map point, or choose a neighborhood below
            to retrieve real local readings.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenLocationModal}
          className="inline-flex items-center gap-2 rounded-lg border border-[#E1EAE4] bg-white px-4 py-2 text-sm font-medium text-[#20332B] hover:bg-[#F5F8F6] transition-colors whitespace-nowrap shrink-0"
        >
          <MapPin className="w-4 h-4 text-[#237A57]" aria-hidden="true" />
          <span>Search City or Neighborhood</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-xl border border-[#E1EAE4] bg-white overflow-hidden">
          <div
            ref={mapContainerRef}
            className="h-[460px] w-full"
            aria-label="Interactive air quality map. Click any point to fetch air quality for those coordinates."
          />
          <div className="border-t border-[#E1EAE4] px-4 py-3 text-xs text-[#66786E] flex flex-wrap items-center justify-between gap-2">
            <span>
              Tip: Click anywhere on the map to retrieve real air-quality readings for
              exact coordinates.
            </span>
            <span className="font-mono tabular-nums">
              Active: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </span>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-[#E1EAE4] bg-white p-5 space-y-3">
            <h2 className="text-xs font-semibold text-[#66786E]">
              Selected Monitoring Point
            </h2>
            <div>
              <p className="text-base font-semibold text-[#20332B]">{location.name}</p>
              {location.neighborhood && (
                <p className="text-xs text-[#66786E]">{location.neighborhood}</p>
              )}
            </div>
            <div className="flex items-baseline gap-2.5 pt-1">
              <span className="text-3xl font-bold font-mono tabular-nums text-[#20332B]">
                {snapshot?.aqi ?? '—'}
              </span>
              <span className="text-xs text-[#66786E]">
                {snapshot?.aqiScale === 'INDIA_NAQI' ? 'CPCB NAQI' : 'US EPA AQI'}
              </span>
            </div>
            <AqiStatusIndicator
              aqi={snapshot?.aqi}
              scale={snapshot?.aqiScale ?? 'US_EPA'}
              compact
            />
            <p className="text-xs text-[#66786E] pt-2 border-t border-[#E1EAE4]">
              Source: {snapshot?.dataSource ?? 'Unavailable'}
            </p>
          </div>

          <div className="rounded-xl border border-[#E1EAE4] bg-white p-5 space-y-3">
            <h2 className="text-xs font-semibold text-[#66786E]">
              Accessible Location Directory
            </h2>
            <p className="text-xs text-[#66786E]">
              Keyboard-accessible list of regional monitoring points:
            </p>
            <ul className="divide-y divide-[#E1EAE4] max-h-60 overflow-y-auto">
              {presets.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setLocation(p)}
                    className={`w-full py-2.5 px-2 text-left text-sm flex items-center justify-between gap-2 rounded hover:bg-[#F5F8F6] transition-colors ${
                      p.id === location.id
                        ? 'font-semibold text-[#18543F]'
                        : 'text-[#20332B]'
                    }`}
                  >
                    <span className="truncate">
                      {p.name}
                      {p.neighborhood ? ` · ${p.neighborhood}` : ''}
                    </span>
                    <span className="text-xs text-[#66786E] shrink-0">
                      {p.countryCode}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
