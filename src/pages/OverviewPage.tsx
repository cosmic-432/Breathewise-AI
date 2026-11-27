import { useState } from 'react';
import {
  ArrowRight,
  Droplets,
  MapPin,
  RefreshCw,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Minus,
  Wind,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AqiStatusIndicator } from '../components/AqiStatusBadge.tsx';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import type { NavSection } from '../types/index.ts';
import {
  celsiusToFahrenheit,
  evaluateDataFreshness,
  formatReadableTimestamp,
  interpretAqi,
} from '../utils/aqi.ts';

interface OverviewPageProps {
  state: BreatheWiseState;
  onNavigate: (section: NavSection) => void;
  onOpenLocationModal: () => void;
}

export function OverviewPage({
  state,
  onNavigate,
  onOpenLocationModal,
}: OverviewPageProps) {
  const { snapshot, loadingAqi, aqiError, refreshAirQuality, location, household } =
    state;
  const [showDataTable, setShowDataTable] = useState(false);

  const aqiInfo = interpretAqi(snapshot?.aqi, snapshot?.aqiScale ?? 'US_EPA');
  const freshness = evaluateDataFreshness(snapshot?.lastUpdated ?? null);
  const useImperial = household.preferredUnitSystem === 'imperial';

  const chartData = (snapshot?.hourlyForecast ?? [])
    .filter((pt) => pt.aqi !== null)
    .slice(0, 18)
    .map((pt) => ({
      time: new Date(pt.time).toLocaleTimeString(undefined, {
        hour: 'numeric',
      }),
      aqi: pt.aqi,
      pm25: pt.pm25,
    }));

  const formatTemp = (c: number | null | undefined) => {
    if (c === null || c === undefined) return 'Unavailable';
    return useImperial ? `${celsiusToFahrenheit(c)} °F` : `${c} °C`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#20332B]">
            Air Quality Overview
          </h1>
          <p className="text-sm text-[#66786E] mt-1">
            Verified local air conditions, pollutant readings, and actionable protection steps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenLocationModal}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E1EAE4] bg-white px-4 py-2 text-sm font-medium text-[#20332B] hover:bg-[#F5F8F6] transition-colors whitespace-nowrap shrink-0"
          >
            <MapPin className="w-4 h-4 text-[#237A57]" aria-hidden="true" />
            <span>
              {location.name}
              {location.neighborhood ? ` · ${location.neighborhood}` : ''}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void refreshAirQuality()}
            disabled={loadingAqi}
            aria-label="Refresh air quality readings"
            className="inline-flex items-center gap-2 rounded-lg border border-[#E1EAE4] bg-white px-3.5 py-2 text-sm font-medium text-[#18543F] hover:bg-[#DDF1E6]/50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-4 h-4 ${loadingAqi ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {aqiError && (
        <div
          role="alert"
          className="rounded-xl border border-[#C94D53]/40 bg-[#FBECEE] p-4 text-sm text-[#962D32]"
        >
          <p className="font-semibold">Unable to retrieve live air quality</p>
          <p className="mt-1">{aqiError}</p>
        </div>
      )}

      {/* Primary Focal Anchor: Live AQI Card + Weather Context */}
      <section
        aria-label="Current air quality summary"
        className="rounded-xl border border-[#E1EAE4] bg-white p-6"
      >
        {loadingAqi && !snapshot ? (
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
                <span className="font-mono tabular-nums">
                  {freshness.label}
                </span>
                {snapshot?.cached && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Cached snapshot (fetched{' '}
                      {formatReadableTimestamp(snapshot.fetchedAt)})
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

            {/* Right Column: Weather & Short-Term Trend */}
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

      {/* Individual Pollutants Breakdown */}
      <section aria-labelledby="pollutants-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="pollutants-heading"
            className="text-base font-semibold text-[#20332B]"
          >
            Pollutant Concentrations
          </h2>
          <span className="text-xs text-[#66786E]">
            Missing pollutants are marked unavailable individually — values are never invented.
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {(snapshot?.pollutants ?? []).map((p) => (
            <div
              key={p.code}
              className="rounded-xl border border-[#E1EAE4] bg-white p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-sm font-semibold text-[#20332B]">
                    {p.code}
                  </span>
                  <span className="text-[11px] text-[#66786E]">
                    {p.status === 'measured'
                      ? 'Measured'
                      : p.status === 'estimated'
                      ? 'Estimated'
                      : 'Unavailable'}
                  </span>
                </div>
                <p className="text-xs text-[#66786E] mt-0.5 line-clamp-1">
                  {p.label}
                </p>
              </div>

              <div className="mt-4">
                {p.value !== null ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono tabular-nums text-[#20332B]">
                      {p.value}
                    </span>
                    <span className="text-xs text-[#66786E]">{p.unit}</span>
                  </div>
                ) : (
                  <span className="text-sm font-medium text-[#66786E]">
                    Unavailable
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Short-Term Forecast Visualization */}
      <section
        aria-labelledby="forecast-heading"
        className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="forecast-heading"
              className="text-base font-semibold text-[#20332B]"
            >
              Next 18-Hour Air Quality Outlook
            </h2>
            <p className="text-xs text-[#66786E] mt-0.5">
              Model-estimated hourly trajectory used to inform lower-exposure routine timing.
            </p>
          </div>
          {chartData.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDataTable((prev) => !prev)}
              className="rounded-lg border border-[#E1EAE4] px-3 py-1.5 text-xs font-medium text-[#20332B] hover:bg-[#F5F8F6] transition-colors whitespace-nowrap"
            >
              {showDataTable ? 'View Chart' : 'View Accessible Data Table'}
            </button>
          )}
        </div>

        {chartData.length === 0 ? (
          <p className="text-sm text-[#66786E] py-6">
            Hourly forecast series is not available from the active data provider for this location.
          </p>
        ) : showDataTable ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#E1EAE4] text-xs text-[#66786E]">
                  <th className="py-2 pr-4 font-medium">Hour</th>
                  <th className="py-2 pr-4 font-medium text-right">Forecast AQI</th>
                  <th className="py-2 font-medium text-right">PM2.5 (µg/m³)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1EAE4]">
                {chartData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="py-2 pr-4 text-[#20332B]">{row.time}</td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums text-[#20332B]">
                      {row.aqi ?? 'N/A'}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-[#66786E]">
                      {row.pm25 ?? 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            className="h-64 w-full"
            role="img"
            aria-label={`Hourly AQI forecast for ${location.name}, ranging from ${Math.min(
              ...chartData.map((d) => d.aqi ?? 0),
            )} to ${Math.max(...chartData.map((d) => d.aqi ?? 0))}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="aqiAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#237A57" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#237A57" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E1EAE4" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#66786E', fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#66786E', fontSize: 12 }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E1EAE4',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="aqi"
                  name="Forecast AQI"
                  stroke="#237A57"
                  strokeWidth={2}
                  fill="url(#aqiAreaFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Connected Workflows */}
      <section aria-label="Next recommended tools" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: 'Adapt Your Daily Routine',
            description:
              'Check commute, workout, and errand timing against today’s local AQI and household profile.',
            cta: 'Open Daily Planner',
            target: 'planner' as NavSection,
          },
          {
            title: 'Protect Your Indoor Air',
            description:
              'Get ventilation timing, CADR purifier sizing, and combustion-source reduction steps.',
            cta: 'Open Indoor Advisor',
            target: 'indoor' as NavSection,
          },
          {
            title: 'Measure Everyday Impact',
            description:
              'Calculate verified CO2, fuel, and trip savings using transparent deterministic emission factors.',
            cta: 'Open Impact Calculator',
            target: 'impact' as NavSection,
          },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-[#E1EAE4] bg-white p-5 flex flex-col justify-between gap-4"
          >
            <div>
              <h3 className="text-base font-semibold text-[#20332B]">
                {card.title}
              </h3>
              <p className="text-sm text-[#66786E] mt-1.5 leading-relaxed">
                {card.description}
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => onNavigate(card.target)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#237A57] hover:text-[#18543F] transition-colors"
              >
                <span>{card.cta}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
