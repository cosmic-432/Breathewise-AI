import { Suspense, lazy, useMemo, useState } from 'react';
import type { HourlyAqiPoint } from '../../types/index.ts';

const ForecastAreaChart = lazy(() =>
  import('./ForecastAreaChart.tsx').then((m) => ({ default: m.ForecastAreaChart })),
);

interface ForecastOutlookCardProps {
  locationName: string;
  hourlyForecast: HourlyAqiPoint[];
}

export function ForecastOutlookCard({
  locationName,
  hourlyForecast,
}: ForecastOutlookCardProps) {
  const [showDataTable, setShowDataTable] = useState(false);

  const chartData = useMemo(
    () =>
      hourlyForecast
        .filter((pt) => pt.aqi !== null)
        .slice(0, 18)
        .map((pt) => ({
          isoTime: pt.time,
          time: new Date(pt.time).toLocaleTimeString(undefined, {
            hour: 'numeric',
          }),
          aqi: pt.aqi,
          pm25: pt.pm25,
        })),
    [hourlyForecast],
  );

  const aqiValues = chartData
    .map((d) => d.aqi)
    .filter((value): value is number => value !== null);

  return (
    <section
      aria-labelledby="forecast-heading"
      className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="forecast-heading" className="text-base font-semibold text-[#20332B]">
            Next 18-Hour Air Quality Outlook
          </h2>
          <p className="text-xs text-[#66786E] mt-0.5">
            Model-estimated hourly trajectory used to inform lower-exposure routine
            timing.
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
          Hourly forecast series is not available from the active data provider for this
          location.
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
              {chartData.map((row) => (
                <tr key={row.isoTime}>
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
          aria-label={`Hourly AQI forecast for ${locationName}, ranging from ${Math.min(...aqiValues)} to ${Math.max(...aqiValues)}.`}
        >
          <Suspense
            fallback={
              <div className="h-full w-full rounded-lg bg-[#F5F8F6] flex items-center justify-center text-xs text-[#66786E]">
                Loading forecast chart...
              </div>
            }
          >
            <ForecastAreaChart chartData={chartData} />
          </Suspense>
        </div>
      )}
    </section>
  );
}
