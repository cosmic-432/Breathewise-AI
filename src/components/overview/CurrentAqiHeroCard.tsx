import {
  ArrowRight,
  Droplets,
  Minus,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Wind,
} from 'lucide-react';
import { AqiStatusIndicator } from '../AqiStatusBadge.tsx';
import type {
  AirQualitySnapshot,
  LocationSelection,
  NavSection,
} from '../../types/index.ts';
import {
  celsiusToFahrenheit,
  evaluateDataFreshness,
  formatReadableTimestamp,
  interpretAqi,
} from '../../utils/aqi.ts';

interface CurrentAqiHeroCardProps {
  snapshot: AirQualitySnapshot | null;
  loading: boolean;
  location: LocationSelection;
  useImperial: boolean;
  onNavigate: (section: NavSection) => void;
}

export function CurrentAqiHeroCard({
  snapshot,
  loading,
  location,
  useImperial,
  onNavigate,
}: CurrentAqiHeroCardProps) {
  const aqiInfo = interpretAqi(snapshot?.aqi, snapshot?.aqiScale ?? 'US_EPA');
  const freshness = evaluateDataFreshness(snapshot?.lastUpdated ?? null);

  const formatTemp = (celsius: number | null | undefined): string => {
    if (celsius === null || celsius === undefined) return 'Unavailable';
    return useImperial ? `${celsiusToFahrenheit(celsius)} °F` : `${celsius} °C`;
  };

  return (
    <section
      aria-label="Current air quality summary"
      className="rounded-xl border border-[#E1EAE4] bg-white p-6"
    >
      {loading && !snapshot ? (
        <div className="animate-pulse space-y-4" aria-busy="true">
          <div className="h-5 w-48 bg-[#E1EAE4] rounded" />
          <div className="h-14 w-32 bg-[#E1EAE4] rounded" />
          <div className="h-4 w-full max-w-xl bg-[#E1EAE4] rounded" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#66786E]">
              <span className="font-medium text-[#20332B]">
                {location.name}
                {location.neighborhood ? `, ${location.neighborhood}` : ''}
              </span>
              <span aria-hidden="true">·</span>
              <span>{location.country}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{freshness.label}</span>
              {snapshot?.cached && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Cached snapshot (fetched {formatReadableTimestamp(snapshot.fetchedAt)}
                    )
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-5">
              <div>
                <span className="text-xs font-medium text-[#66786E] block mb-1">
                  {snapshot?.aqiScale === 'INDIA_NAQI'
                    ? 'Air Quality Index (CPCB NAQI)'
                    : 'Air Quality Index (US EPA)'}
                </span>
                <div className="flex items-baseline gap-3">
                  <span
                    className="text-5xl font-bold font-mono tabular-nums tracking-tight"
                    style={{ color: aqiInfo.hexColor }}
                  >
                    {snapshot?.aqi !== null && snapshot?.aqi !== undefined
                      ? snapshot.aqi
                      : '—'}
                  </span>
                  <span className="text-xs font-medium text-[#66786E]">
                    {snapshot?.aqiStatus === 'measured'
                      ? 'Measured at station'
                      : snapshot?.aqiStatus === 'estimated'
                        ? 'Model-estimated'
                        : 'Unavailable'}
                  </span>
                </div>
              </div>

              <div className="pb-1.5 space-y-1">
                <AqiStatusIndicator
                  aqi={snapshot?.aqi}
                  scale={snapshot?.aqiScale ?? 'US_EPA'}
                />
                {snapshot?.dominantPollutant && (
                  <p className="text-xs text-[#66786E]">
                    Primary pollutant driver:{' '}
                    <span className="font-mono font-medium text-[#20332B]">
                      {snapshot.dominantPollutant}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <p className="text-sm leading-relaxed text-[#20332B] max-w-2xl">
              {aqiInfo.healthGuidance}
            </p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 border-t border-[#E1EAE4] text-xs text-[#66786E]">
              <span>
                Source:{' '}
                <strong className="font-medium text-[#20332B]">
                  {snapshot?.dataSource ?? 'Unavailable'}
                </strong>
              </span>
              {snapshot?.stationName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Station: {snapshot.stationName}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Reading time: {formatReadableTimestamp(snapshot?.lastUpdated ?? null)}
              </span>
            </div>

            {snapshot?.notice && (
              <p className="text-xs text-[#66786E] bg-[#F5F8F6] rounded-lg px-3.5 py-2.5 border border-[#E1EAE4]">
                {snapshot.notice}
              </p>
            )}
          </div>

          <div className="lg:col-span-4 lg:border-l lg:border-[#E1EAE4] lg:pl-6 space-y-5">
            <div>
              <h2 className="text-xs font-semibold text-[#66786E] mb-3">
                Local Weather Conditions
              </h2>
              {snapshot?.weather.status === 'unavailable' ? (
                <p className="text-sm text-[#66786E]">
                  Reliable weather readings are currently unavailable for this location.
                </p>
              ) : (
                <dl className="grid grid-cols-3 gap-3">
                  <div>
                    <dt className="text-xs text-[#66786E] flex items-center gap-1">
                      <Thermometer className="w-3.5 h-3.5" aria-hidden="true" />
                      Temp
                    </dt>
                    <dd className="text-base font-semibold font-mono tabular-nums text-[#20332B] mt-1">
                      {formatTemp(snapshot?.weather.temperatureC)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#66786E] flex items-center gap-1">
                      <Droplets className="w-3.5 h-3.5" aria-hidden="true" />
                      Humidity
                    </dt>
                    <dd className="text-base font-semibold font-mono tabular-nums text-[#20332B] mt-1">
                      {snapshot?.weather.humidityPercent !== null &&
                      snapshot?.weather.humidityPercent !== undefined
                        ? `${snapshot.weather.humidityPercent}%`
                        : 'N/A'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#66786E] flex items-center gap-1">
                      <Wind className="w-3.5 h-3.5" aria-hidden="true" />
                      Wind
                    </dt>
                    <dd className="text-base font-semibold font-mono tabular-nums text-[#20332B] mt-1">
                      {snapshot?.weather.windSpeedKmh !== null &&
                      snapshot?.weather.windSpeedKmh !== undefined
                        ? `${snapshot.weather.windSpeedKmh} km/h`
                        : 'N/A'}
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            <div className="border-t border-[#E1EAE4] pt-4">
              <h2 className="text-xs font-semibold text-[#66786E] mb-2">
                Short-Term Trend
              </h2>
              <div className="flex items-start gap-2.5 text-sm text-[#20332B]">
                {snapshot?.trend === 'improving' ? (
                  <TrendingDown
                    className="w-4 h-4 text-[#237A57] mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                ) : snapshot?.trend === 'worsening' ? (
                  <TrendingUp
                    className="w-4 h-4 text-[#C94D53] mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <Minus
                    className="w-4 h-4 text-[#66786E] mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <p className="leading-snug">
                  {snapshot?.trendSummary ?? 'Short-term forecast unavailable.'}
                </p>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => onNavigate('assistant')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#237A57] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18543F] transition-colors whitespace-nowrap"
              >
                <span>Ask BreatheWise AI About Today</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
