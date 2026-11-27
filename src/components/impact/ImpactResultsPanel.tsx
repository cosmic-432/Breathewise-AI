import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ImpactCalculationResult } from '../../types/index.ts';

interface ImpactResultsPanelProps {
  result: ImpactCalculationResult;
}

export function ImpactResultsPanel({ result }: ImpactResultsPanelProps) {
  const [showComparisonTable, setShowComparisonTable] = useState(false);

  const comparisonData =
    result.quantifiable && result.beforeCo2Kg !== null && result.afterCo2Kg !== null
      ? [
          { scenario: 'Before Change', co2Kg: result.beforeCo2Kg },
          { scenario: 'After Change', co2Kg: result.afterCo2Kg },
        ]
      : [];

  return (
    <section
      aria-labelledby="calc-results-heading"
      className="lg:col-span-7 rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2
            id="calc-results-heading"
            className="text-base font-semibold text-[#20332B]"
          >
            Before vs. After Impact Estimate
          </h2>
          <span className="text-xs text-[#66786E]">
            Deterministic formula · No AI-generated arithmetic
          </span>
        </div>
        {comparisonData.length > 0 && (
          <button
            type="button"
            onClick={() => setShowComparisonTable((prev) => !prev)}
            className="rounded-lg border border-[#E1EAE4] px-3 py-1.5 text-xs font-medium text-[#20332B] hover:bg-[#F5F8F6] transition-colors whitespace-nowrap"
          >
            {showComparisonTable ? 'View Chart' : 'View Accessible Table'}
          </button>
        )}
      </div>

      {result.quantifiable ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-[#F5F8F6] border border-[#E1EAE4] p-4">
              <p className="text-xs text-[#66786E]">CO2 Avoided</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-[#18543F] mt-1">
                {result.co2AvoidedKg} kg
              </p>
            </div>
            <div className="rounded-lg bg-[#F5F8F6] border border-[#E1EAE4] p-4">
              <p className="text-xs text-[#66786E]">
                {result.kwhSaved !== null ? 'Electricity Saved' : 'Fuel Saved'}
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-[#20332B] mt-1">
                {result.kwhSaved !== null
                  ? `${result.kwhSaved} kWh`
                  : `${result.fuelSavedLiters ?? 0} L`}
              </p>
            </div>
            <div className="rounded-lg bg-[#F5F8F6] border border-[#E1EAE4] p-4">
              <p className="text-xs text-[#66786E]">Trips Reduced</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-[#20332B] mt-1">
                {result.tripsReduced}
              </p>
            </div>
          </div>

          {comparisonData.length > 0 &&
            (showComparisonTable ? (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#E1EAE4] text-xs text-[#66786E]">
                    <th className="py-2 pr-4 font-medium">Scenario</th>
                    <th className="py-2 font-medium text-right">Estimated CO2 (kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1EAE4]">
                  {comparisonData.map((row) => (
                    <tr key={row.scenario}>
                      <td className="py-2 pr-4 text-[#20332B]">{row.scenario}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-[#18543F]">
                        {row.co2Kg} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div
                className="h-52 w-full"
                role="img"
                aria-label={`Bar chart comparing emissions before change (${result.beforeCo2Kg} kg CO2) versus after change (${result.afterCo2Kg} kg CO2).`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={comparisonData}
                    margin={{ top: 8, right: 16, left: -8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E1EAE4" />
                    <XAxis dataKey="scenario" tick={{ fill: '#20332B', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#66786E', fontSize: 12 }} unit=" kg" />
                    <Tooltip />
                    <Bar
                      dataKey="co2Kg"
                      name="Estimated CO2 (kg)"
                      fill="#237A57"
                      radius={[6, 6, 0, 0]}
                      barSize={56}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ))}
        </>
      ) : (
        <div className="rounded-lg border border-[#5B9CCB]/30 bg-[#E6F2F9]/50 p-4 space-y-2">
          <p className="text-sm font-semibold text-[#20332B]">
            Educational Impact Assessment (No Fabricated Numerical Factor)
          </p>
          <p className="text-sm text-[#20332B]/90 leading-relaxed">
            {result.educationalNote}
          </p>
        </div>
      )}

      <dl className="border-t border-[#E1EAE4] pt-4 space-y-2.5 text-xs">
        <div>
          <dt className="font-semibold text-[#20332B] inline">Baseline (Before): </dt>
          <dd className="inline text-[#66786E]">{result.beforeScenario}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[#20332B] inline">Adopted (After): </dt>
          <dd className="inline text-[#66786E]">{result.afterScenario}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[#20332B] inline">Emission factor: </dt>
          <dd className="inline font-mono text-[#20332B]">
            {result.emissionFactorLabel}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-[#20332B] inline">Units: </dt>
          <dd className="inline text-[#66786E]">{result.units}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[#20332B] inline">Data source: </dt>
          <dd className="inline text-[#66786E]">{result.dataSource}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[#20332B] inline">Uncertainty: </dt>
          <dd className="inline text-[#66786E]">{result.uncertainty}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[#20332B] inline">Assumptions: </dt>
          <dd className="inline text-[#66786E]">{result.assumptions.join(' · ')}</dd>
        </div>
        <div className="rounded-lg bg-[#F5F8F6] border border-[#E1EAE4] p-3 text-[#20332B]">
          <strong>CO2 vs. Local AQI Distinction: </strong>
          {result.localPollutantDistinction}
        </div>
      </dl>
    </section>
  );
}
