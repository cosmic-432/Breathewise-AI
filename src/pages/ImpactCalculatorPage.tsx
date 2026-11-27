import { useMemo, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import type {
  HouseholdProfile,
  ImpactActionType,
  RecordedImpactAction,
} from '../types/index.ts';
import { calculateEnvironmentalImpact } from '../utils/impactCalculator.ts';

interface ImpactCalculatorPageProps {
  state: BreatheWiseState;
}

const ACTION_OPTIONS: Array<{ id: ImpactActionType; label: string }> = [
  { id: 'carpool', label: 'Carpool instead of solo driving' },
  { id: 'combine_errands', label: 'Combine multiple errands into one trip' },
  { id: 'public_transit', label: 'Use metro or public bus transit' },
  { id: 'electricity_reduction', label: 'Reduce household electricity usage' },
  { id: 'avoid_waste_burning', label: 'Avoid open leaf or waste burning' },
  { id: 'cleaner_cooking', label: 'Use cleaner cooking fuel & exhaust' },
];

export function ImpactCalculatorPage({ state }: ImpactCalculatorPageProps) {
  const { household, impactActions, addImpactAction, removeImpactAction } = state;

  const [actionType, setActionType] = useState<ImpactActionType>('carpool');
  const [distanceKm, setDistanceKm] = useState(14);
  const [passengersShared, setPassengersShared] = useState(3);
  const [tripsConsolidated, setTripsConsolidated] = useState(2);
  const [kwhSaved, setKwhSaved] = useState(20);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [regionGrid, setRegionGrid] = useState<HouseholdProfile['regionGrid']>(
    household.regionGrid,
  );
  const [justLogged, setJustLogged] = useState(false);
  const [showComparisonTable, setShowComparisonTable] = useState(false);

  const result = useMemo(
    () =>
      calculateEnvironmentalImpact({
        type: actionType,
        distanceKm,
        passengersShared,
        tripsConsolidated,
        kwhSaved,
        daysPerWeek,
        regionGrid,
      }),
    [
      actionType,
      distanceKm,
      passengersShared,
      tripsConsolidated,
      kwhSaved,
      daysPerWeek,
      regionGrid,
    ],
  );

  const totals = useMemo(() => {
    return impactActions.reduce(
      (acc, item) => ({
        co2Kg: Number((acc.co2Kg + (item.co2AvoidedKg ?? 0)).toFixed(2)),
        fuelLiters: Number((acc.fuelLiters + (item.fuelSavedLiters ?? 0)).toFixed(2)),
        tripsReduced: acc.tripsReduced + item.tripsReduced,
        kwhSaved: Number((acc.kwhSaved + (item.kwhSaved ?? 0)).toFixed(1)),
      }),
      { co2Kg: 0, fuelLiters: 0, tripsReduced: 0, kwhSaved: 0 },
    );
  }, [impactActions]);

  const handleLogAction = () => {
    const label =
      ACTION_OPTIONS.find((a) => a.id === actionType)?.label ?? actionType;
    const entry: RecordedImpactAction = {
      id: `imp-${Date.now()}`,
      type: actionType,
      label,
      dateIso: new Date().toISOString(),
      quantity:
        actionType === 'electricity_reduction'
          ? kwhSaved
          : actionType === 'combine_errands'
          ? tripsConsolidated
          : daysPerWeek,
      unit:
        actionType === 'electricity_reduction'
          ? 'kWh'
          : actionType === 'combine_errands'
          ? 'trips'
          : 'days',
      co2AvoidedKg: result.co2AvoidedKg,
      fuelSavedLiters: result.fuelSavedLiters,
      tripsReduced: result.tripsReduced,
      kwhSaved: result.kwhSaved,
      regionGrid,
    };
    addImpactAction(entry);
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 2200);
  };

  const comparisonData =
    result.quantifiable &&
    result.beforeCo2Kg !== null &&
    result.afterCo2Kg !== null
      ? [
          { scenario: 'Before Change', co2Kg: result.beforeCo2Kg },
          { scenario: 'After Change', co2Kg: result.afterCo2Kg },
        ]
      : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#20332B]">
          Environmental Impact Calculator
        </h1>
        <p className="text-sm text-[#66786E] mt-1">
          Transparent, deterministic calculations showing your estimated CO2, fuel, trip, and electricity savings — with explicit assumptions and uncertainty.
        </p>
      </div>

      {/* Cumulative Recorded Totals */}
      <section aria-label="Your cumulative recorded impact">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Estimated CO2 Avoided',
              value: `${totals.co2Kg} kg`,
              sub: 'Deterministic logged total',
            },
            {
              label: 'Estimated Fuel Saved',
              value: `${totals.fuelLiters} L`,
              sub: 'Petrol-equivalent baseline',
            },
            {
              label: 'Vehicle Trips Reduced',
              value: String(totals.tripsReduced),
              sub: 'Carpool, transit & batched errands',
            },
            {
              label: 'Household Energy Saved',
              value: `${totals.kwhSaved} kWh`,
              sub: `${impactActions.length} logged action(s)`,
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-[#E1EAE4] bg-white p-5"
            >
              <p className="text-xs font-medium text-[#66786E]">{kpi.label}</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-[#18543F] mt-1.5">
                {kpi.value}
              </p>
              <p className="text-xs text-[#66786E] mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Calculator Inputs */}
        <section
          aria-labelledby="calc-inputs-heading"
          className="lg:col-span-5 rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-5"
        >
          <h2
            id="calc-inputs-heading"
            className="text-base font-semibold text-[#20332B]"
          >
            Configure Scenario
          </h2>

          <div>
            <label
              htmlFor="impact-action-select"
              className="block text-xs font-medium text-[#20332B] mb-1.5"
            >
              Sustainable action
            </label>
            <select
              id="impact-action-select"
              value={actionType}
              onChange={(e) => setActionType(e.target.value as ImpactActionType)}
              className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2.5 text-sm text-[#20332B]"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {(actionType === 'carpool' || actionType === 'public_transit') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="impact-distance"
                  className="block text-xs font-medium text-[#20332B] mb-1.5"
                >
                  Daily round-trip (km)
                </label>
                <input
                  id="impact-distance"
                  type="number"
                  min={1}
                  max={500}
                  value={distanceKm}
                  onChange={(e) =>
                    setDistanceKm(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label
                  htmlFor="impact-days"
                  className="block text-xs font-medium text-[#20332B] mb-1.5"
                >
                  Days per week
                </label>
                <input
                  id="impact-days"
                  type="number"
                  min={1}
                  max={7}
                  value={daysPerWeek}
                  onChange={(e) =>
                    setDaysPerWeek(
                      Math.max(1, Math.min(7, Number(e.target.value) || 1)),
                    )
                  }
                  className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>
            </div>
          )}

          {actionType === 'carpool' && (
            <div>
              <label
                htmlFor="impact-passengers"
                className="block text-xs font-medium text-[#20332B] mb-1.5"
              >
                Total people sharing the car (2–6)
              </label>
              <input
                id="impact-passengers"
                type="number"
                min={2}
                max={6}
                value={passengersShared}
                onChange={(e) =>
                  setPassengersShared(
                    Math.max(2, Math.min(6, Number(e.target.value) || 2)),
                  )
                }
                className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
          )}

          {actionType === 'combine_errands' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="impact-trips"
                  className="block text-xs font-medium text-[#20332B] mb-1.5"
                >
                  Separate trips avoided
                </label>
                <input
                  id="impact-trips"
                  type="number"
                  min={1}
                  max={20}
                  value={tripsConsolidated}
                  onChange={(e) =>
                    setTripsConsolidated(
                      Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                    )
                  }
                  className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label
                  htmlFor="impact-errand-km"
                  className="block text-xs font-medium text-[#20332B] mb-1.5"
                >
                  Avg km per avoided trip
                </label>
                <input
                  id="impact-errand-km"
                  type="number"
                  min={1}
                  max={100}
                  value={distanceKm}
                  onChange={(e) =>
                    setDistanceKm(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>
            </div>
          )}

          {actionType === 'electricity_reduction' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="impact-kwh"
                  className="block text-xs font-medium text-[#20332B] mb-1.5"
                >
                  Electricity saved (kWh)
                </label>
                <input
                  id="impact-kwh"
                  type="number"
                  min={1}
                  max={5000}
                  value={kwhSaved}
                  onChange={(e) =>
                    setKwhSaved(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label
                  htmlFor="impact-grid"
                  className="block text-xs font-medium text-[#20332B] mb-1.5"
                >
                  Electricity grid factor
                </label>
                <select
                  id="impact-grid"
                  value={regionGrid}
                  onChange={(e) =>
                    setRegionGrid(e.target.value as HouseholdProfile['regionGrid'])
                  }
                  className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm"
                >
                  <option value="india">India (CEA 0.727)</option>
                  <option value="global">Global Avg (0.436)</option>
                  <option value="us">US eGRID (0.373)</option>
                  <option value="eu">EU EEA (0.242)</option>
                </select>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogAction}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#237A57] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18543F] transition-colors"
          >
            {justLogged ? (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>Action Logged to Your Impact</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Record Action &amp; Update My Impact</span>
              </>
            )}
          </button>
        </section>

        {/* Right: Before vs After Comparison & Method Transparency */}
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
                        <th className="py-2 font-medium text-right">
                          Estimated CO2 (kg)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E1EAE4]">
                      {comparisonData.map((row) => (
                        <tr key={row.scenario}>
                          <td className="py-2 pr-4 text-[#20332B]">
                            {row.scenario}
                          </td>
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
                        <XAxis
                          dataKey="scenario"
                          tick={{ fill: '#20332B', fontSize: 12 }}
                        />
                        <YAxis
                          tick={{ fill: '#66786E', fontSize: 12 }}
                          unit=" kg"
                        />
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

          {/* Methodology & Scientific Integrity Block */}
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
              <dd className="inline text-[#66786E]">
                {result.assumptions.join(' · ')}
              </dd>
            </div>
            <div className="rounded-lg bg-[#F5F8F6] border border-[#E1EAE4] p-3 text-[#20332B]">
              <strong>CO2 vs. Local AQI Distinction: </strong>
              {result.localPollutantDistinction}
            </div>
          </dl>
        </section>
      </div>

      {/* Logged Actions Table */}
      <section
        aria-labelledby="logged-actions-heading"
        className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
      >
        <h2
          id="logged-actions-heading"
          className="text-base font-semibold text-[#20332B]"
        >
          Your Recorded Sustainable Actions ({impactActions.length})
        </h2>

        {impactActions.length === 0 ? (
          <p className="text-sm text-[#66786E]">
            No actions logged yet. Configure an action above and click &ldquo;Record Action &amp; Update My Impact&rdquo; to track your verified progress.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#E1EAE4] text-xs text-[#66786E]">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 pr-4 font-medium text-right">CO2 Avoided</th>
                  <th className="py-2 pr-4 font-medium text-right">Fuel / Energy</th>
                  <th className="py-2 pr-4 font-medium text-right">Trips</th>
                  <th className="py-2 font-medium text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1EAE4]">
                {impactActions.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 pr-4 text-xs font-mono tabular-nums text-[#66786E] whitespace-nowrap">
                      {new Date(item.dateIso).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 pr-4 text-[#20332B] font-medium">
                      {item.label}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#18543F]">
                      {item.co2AvoidedKg !== null ? `${item.co2AvoidedKg} kg` : 'Qualitative'}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#20332B]">
                      {item.kwhSaved !== null
                        ? `${item.kwhSaved} kWh`
                        : item.fuelSavedLiters !== null
                        ? `${item.fuelSavedLiters} L`
                        : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#20332B]">
                      {item.tripsReduced}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeImpactAction(item.id)}
                        aria-label={`Delete logged action ${item.label}`}
                        className="text-[#66786E] hover:text-[#C94D53] p-1"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
