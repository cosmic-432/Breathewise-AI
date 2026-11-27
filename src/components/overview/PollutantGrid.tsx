import type { PollutantReading } from '../../types/index.ts';

interface PollutantGridProps {
  pollutants: PollutantReading[];
}

export function PollutantGrid({ pollutants }: PollutantGridProps) {
  return (
    <section aria-labelledby="pollutants-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pollutants-heading" className="text-base font-semibold text-[#20332B]">
          Pollutant Concentrations
        </h2>
        <span className="text-xs text-[#66786E]">
          Missing pollutants are marked unavailable individually — values are never
          invented.
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {pollutants.map((pollutant) => (
          <div
            key={pollutant.code}
            className="rounded-xl border border-[#E1EAE4] bg-white p-4 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-sm font-semibold text-[#20332B]">
                  {pollutant.code}
                </span>
                <span className="text-[11px] text-[#66786E]">
                  {pollutant.status === 'measured'
                    ? 'Measured'
                    : pollutant.status === 'estimated'
                      ? 'Estimated'
                      : 'Unavailable'}
                </span>
              </div>
              <p className="text-xs text-[#66786E] mt-0.5 line-clamp-1">
                {pollutant.label}
              </p>
            </div>

            <div className="mt-4">
              {pollutant.value !== null ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono tabular-nums text-[#20332B]">
                    {pollutant.value}
                  </span>
                  <span className="text-xs text-[#66786E]">{pollutant.unit}</span>
                </div>
              ) : (
                <span className="text-sm font-medium text-[#66786E]">Unavailable</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
