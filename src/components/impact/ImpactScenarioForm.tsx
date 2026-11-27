import { Check, Plus } from 'lucide-react';
import type { HouseholdProfile, ImpactActionType } from '../../types/index.ts';
import { isOneOf } from '../../utils/typeGuards.ts';

export const IMPACT_ACTION_OPTIONS: ReadonlyArray<{
  id: ImpactActionType;
  label: string;
}> = [
  { id: 'carpool', label: 'Carpool instead of solo driving' },
  { id: 'combine_errands', label: 'Combine multiple errands into one trip' },
  { id: 'public_transit', label: 'Use metro or public bus transit' },
  { id: 'electricity_reduction', label: 'Reduce household electricity usage' },
  { id: 'avoid_waste_burning', label: 'Avoid open leaf or waste burning' },
  { id: 'cleaner_cooking', label: 'Use cleaner cooking fuel & exhaust' },
];

const IMPACT_ACTION_IDS: readonly ImpactActionType[] = IMPACT_ACTION_OPTIONS.map(
  (opt) => opt.id,
);

const REGION_GRID_VALUES: readonly HouseholdProfile['regionGrid'][] = [
  'india',
  'global',
  'us',
  'eu',
];

interface ImpactScenarioFormProps {
  actionType: ImpactActionType;
  distanceKm: number;
  passengersShared: number;
  tripsConsolidated: number;
  kwhSaved: number;
  daysPerWeek: number;
  regionGrid: HouseholdProfile['regionGrid'];
  justLogged: boolean;
  onActionTypeChange: (value: ImpactActionType) => void;
  onDistanceKmChange: (value: number) => void;
  onPassengersSharedChange: (value: number) => void;
  onTripsConsolidatedChange: (value: number) => void;
  onKwhSavedChange: (value: number) => void;
  onDaysPerWeekChange: (value: number) => void;
  onRegionGridChange: (value: HouseholdProfile['regionGrid']) => void;
  onLogAction: () => void;
}

export function ImpactScenarioForm({
  actionType,
  distanceKm,
  passengersShared,
  tripsConsolidated,
  kwhSaved,
  daysPerWeek,
  regionGrid,
  justLogged,
  onActionTypeChange,
  onDistanceKmChange,
  onPassengersSharedChange,
  onTripsConsolidatedChange,
  onKwhSavedChange,
  onDaysPerWeekChange,
  onRegionGridChange,
  onLogAction,
}: ImpactScenarioFormProps) {
  return (
    <section
      aria-labelledby="calc-inputs-heading"
      className="lg:col-span-5 rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-5"
    >
      <h2 id="calc-inputs-heading" className="text-base font-semibold text-[#20332B]">
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
          onChange={(e) => {
            if (isOneOf(e.target.value, IMPACT_ACTION_IDS)) {
              onActionTypeChange(e.target.value);
            }
          }}
          className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2.5 text-sm text-[#20332B]"
        >
          {IMPACT_ACTION_OPTIONS.map((opt) => (
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
                onDistanceKmChange(Math.max(1, Number(e.target.value) || 1))
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
                onDaysPerWeekChange(Math.max(1, Math.min(7, Number(e.target.value) || 1)))
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
              onPassengersSharedChange(
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
                onTripsConsolidatedChange(
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
                onDistanceKmChange(Math.max(1, Number(e.target.value) || 1))
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
              onChange={(e) => onKwhSavedChange(Math.max(1, Number(e.target.value) || 1))}
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
              onChange={(e) => {
                if (isOneOf(e.target.value, REGION_GRID_VALUES)) {
                  onRegionGridChange(e.target.value);
                }
              }}
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
        onClick={onLogAction}
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
  );
}
