import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import { formatReadableTimestamp } from '../utils/aqi.ts';

interface HistoryPageProps {
  state: BreatheWiseState;
}

export function HistoryPage({ state }: HistoryPageProps) {
  const { aqiHistory, impactActions } = state;
  const [showTable, setShowTable] = useState(false);

  const orderedReadings = useMemo(
    () => [...aqiHistory].reverse(),
    [aqiHistory],
  );

  const chartData = useMemo(
    () =>
      orderedReadings.map((r) => ({
        time: new Date(r.recordedAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        aqi: r.aqi,
        pm25: r.pm25,
        pm10: r.pm10,
      })),
    [orderedReadings],
  );

  const summaryStats = useMemo(() => {
    const validAqi = aqiHistory
      .map((r) => r.aqi)
      .filter((v): v is number => v !== null);
    if (validAqi.length === 0) return null;
    const avg = Math.round(
      validAqi.reduce((a, b) => a + b, 0) / validAqi.length,
    );
    return {
      count: validAqi.length,
      avgAqi: avg,
      maxAqi: Math.max(...validAqi),
      minAqi: Math.min(...validAqi),
    };
  }, [aqiHistory]);

  const totalCo2Avoided = useMemo(
    () =>
      Number(
        impactActions
          .reduce((acc, item) => acc + (item.co2AvoidedKg ?? 0), 0)
          .toFixed(2),
      ),
    [impactActions],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#20332B]">
          Air Quality History &amp; Insights
        </h1>
        <p className="text-sm text-[#66786E] mt-1">
          Stored provider readings are strictly separated from your personal activity records. Historical readings are never manufactured.
        </p>
      </div>

      {/* Section 1: Stored Provider AQI & Pollutant Readings */}
      <section
        aria-labelledby="provider-history-heading"
        className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="provider-history-heading"
              className="text-base font-semibold text-[#20332B]"
            >
              1. Retrieved Environmental Readings (Measured / Provider-Supplied)
            </h2>
            <p className="text-xs text-[#66786E] mt-0.5">
              Automatically logged whenever BreatheWise AI retrieves a verified non-null snapshot.
            </p>
          </div>

          {chartData.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTable((prev) => !prev)}
              className="rounded-lg border border-[#E1EAE4] px-3 py-1.5 text-xs font-medium text-[#20332B] hover:bg-[#F5F8F6] transition-colors whitespace-nowrap"
            >
              {showTable ? 'Show Trend Chart' : 'Show Accessible Table'}
            </button>
          )}
        </div>

        {summaryStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-[#F5F8F6] border border-[#E1EAE4] p-3.5">
              <p className="text-xs text-[#66786E]">Recorded Snapshots</p>
              <p className="text-xl font-bold font-mono tabular-nums text-[#20332B] mt-0.5">
                {summaryStats.count}
              </p>
            </div>
            <div className="rounded-lg bg-[#F5F8F6] border border-[#E1EAE4] p-3.5">
              <p className="text-xs text-[#66786E]">Average AQI</p>
              <p className="text-xl font-bold font-mono tabular-nums text-[#20332B] mt-0.5">
                {summaryStats.avgAqi}
              </p>
            </div>
            <div className="rounded-lg bg-[#F5F8F6] border border-[#E1EAE4] p-3.5">
              <p className="text-xs text-[#66786E]">Peak Observed AQI</p>
              <p className="text-xl font-bold font-mono tabular-nums text-[#C94D53] mt-0.5">
                {summaryStats.maxAqi}
              </p>
            </div>
            <div className="rounded-lg bg-[#F5F8F6] border border-[#E1EAE4] p-3.5">
              <p className="text-xs text-[#66786E]">Lowest Observed AQI</p>
              <p className="text-xl font-bold font-mono tabular-nums text-[#237A57] mt-0.5">
                {summaryStats.minAqi}
              </p>
            </div>
          </div>
        )}

        {aqiHistory.length === 0 ? (
          <p className="text-sm text-[#66786E] py-4">
            No historical readings stored yet. As you inspect locations over time, real retrieved readings will appear here without fabricating synthetic trends.
          </p>
        ) : showTable || chartData.length < 2 ? (
          <div className="space-y-3">
            {chartData.length < 2 && (
              <p className="text-xs text-[#66786E]">
                A multi-point trend chart will automatically render once at least 2 readings are recorded over time or across locations.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#E1EAE4] text-xs text-[#66786E]">
                    <th className="py-2 pr-4 font-medium">Timestamp</th>
                    <th className="py-2 pr-4 font-medium">Location</th>
                    <th className="py-2 pr-4 font-medium text-right">AQI</th>
                    <th className="py-2 pr-4 font-medium text-right">PM2.5</th>
                    <th className="py-2 pr-4 font-medium text-right">PM10</th>
                    <th className="py-2 font-medium">Source &amp; Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1EAE4]">
                  {aqiHistory.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 pr-4 text-xs font-mono tabular-nums text-[#66786E] whitespace-nowrap">
                        {formatReadableTimestamp(r.recordedAt)}
                      </td>
                      <td className="py-2.5 pr-4 text-[#20332B] font-medium">
                        {r.locationName}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#20332B]">
                        {r.aqi ?? 'N/A'}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#66786E]">
                        {r.pm25 !== null ? `${r.pm25} µg/m³` : 'N/A'}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#66786E]">
                        {r.pm10 !== null ? `${r.pm10} µg/m³` : 'N/A'}
                      </td>
                      <td className="py-2.5 text-xs text-[#66786E]">
                        {r.dataSource} · {r.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div
            className="h-72 w-full"
            role="img"
            aria-label={`Line chart of ${chartData.length} recorded AQI, PM2.5, and PM10 readings.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 16, left: -12, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E1EAE4" />
                <XAxis dataKey="time" tick={{ fill: '#66786E', fontSize: 11 }} />
                <YAxis tick={{ fill: '#66786E', fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="aqi"
                  name="AQI"
                  stroke="#18543F"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="pm25"
                  name="PM2.5 (µg/m³)"
                  stroke="#5B9CCB"
                  strokeWidth={2}
                  dot={{ r: 2.5 }}
                />
                <Line
                  type="monotone"
                  dataKey="pm10"
                  name="PM10 (µg/m³)"
                  stroke="#D68A35"
                  strokeWidth={2}
                  dot={{ r: 2.5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Section 2: User-Generated Household Action History */}
      <section
        aria-labelledby="user-action-history-heading"
        className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2
              id="user-action-history-heading"
              className="text-base font-semibold text-[#20332B]"
            >
              2. Household Action &amp; Environmental Impact Progress (User-Generated)
            </h2>
            <p className="text-xs text-[#66786E] mt-0.5">
              Self-reported sustainable actions recorded in your Impact Calculator.
            </p>
          </div>
          <span className="text-sm font-mono tabular-nums font-semibold text-[#18543F]">
            Cumulative CO2 avoided: {totalCo2Avoided} kg
          </span>
        </div>

        {impactActions.length === 0 ? (
          <p className="text-sm text-[#66786E]">
            No household sustainable actions recorded yet. Log a carpool, transit, or electricity-saving action in &ldquo;My Impact&rdquo; to track progress over time.
          </p>
        ) : (
          <ul className="divide-y divide-[#E1EAE4]">
            {impactActions.map((act) => (
              <li
                key={act.id}
                className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-medium text-[#20332B]">{act.label}</p>
                  <p className="text-xs text-[#66786E]">
                    Recorded {formatReadableTimestamp(act.dateIso)} · User-generated record
                  </p>
                </div>
                <div className="text-xs font-mono tabular-nums text-[#18543F]">
                  {act.co2AvoidedKg !== null
                    ? `${act.co2AvoidedKg} kg CO2 avoided`
                    : 'Qualitative clean-air action'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
