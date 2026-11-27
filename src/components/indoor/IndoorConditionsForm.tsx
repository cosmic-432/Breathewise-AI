import type { IndoorConditions } from '../../types/index.ts';
import { isOneOf } from '../../utils/typeGuards.ts';

const VENTILATION_OPTIONS: readonly IndoorConditions['ventilation'][] = [
  'natural_windows',
  'closed',
  'exhaust_fans',
  'mechanical_hvac',
];

const COOKING_FUEL_OPTIONS: readonly IndoorConditions['cookingFuel'][] = [
  'electric_induction',
  'lpg_piped_gas',
  'solid_biomass_coal',
  'mixed',
];

const FILTER_TYPE_OPTIONS: readonly IndoorConditions['filterType'][] = [
  'none',
  'true_hepa',
  'hepa_carbon',
  'basic_dust',
  'ionizer_ozone',
  'unknown',
];

const NEARBY_SOURCE_OPTIONS = [
  'Busy main road nearby',
  'Active construction / road dust',
  'Industrial area or diesel generators',
  'Seasonal crop or waste smoke',
] as const;

interface IndoorConditionsFormProps {
  indoor: IndoorConditions;
  onChange: (next: IndoorConditions) => void;
}

export function IndoorConditionsForm({ indoor, onChange }: IndoorConditionsFormProps) {
  const updateField = <K extends keyof IndoorConditions>(
    key: K,
    value: IndoorConditions[K],
  ) => {
    onChange({ ...indoor, [key]: value });
  };

  const toggleNearbySource = (src: string) => {
    const exists = indoor.nearbySources.includes(src);
    updateField(
      'nearbySources',
      exists
        ? indoor.nearbySources.filter((s) => s !== src)
        : [...indoor.nearbySources, src],
    );
  };

  return (
    <section
      aria-labelledby="indoor-form-heading"
      className="lg:col-span-5 rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-5"
    >
      <div>
        <h2 id="indoor-form-heading" className="text-base font-semibold text-[#20332B]">
          Your Home &amp; Room Conditions
        </h2>
        <p className="text-xs text-[#52645A] mt-0.5">
          Changes save automatically and recalculate CADR and ventilation guidance
          immediately.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="room-size"
            className="block text-xs font-medium text-[#20332B] mb-1.5"
          >
            Approx. room size (m²)
          </label>
          <input
            id="room-size"
            type="number"
            min={4}
            max={400}
            value={indoor.roomSizeSqm}
            onChange={(e) =>
              updateField(
                'roomSizeSqm',
                Math.max(4, Math.min(400, Number(e.target.value) || 4)),
              )
            }
            className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm font-mono tabular-nums text-[#20332B]"
          />
        </div>

        <div>
          <label
            htmlFor="room-occupants"
            className="block text-xs font-medium text-[#20332B] mb-1.5"
          >
            Occupants
          </label>
          <input
            id="room-occupants"
            type="number"
            min={1}
            max={20}
            value={indoor.occupants}
            onChange={(e) =>
              updateField(
                'occupants',
                Math.max(1, Math.min(20, Number(e.target.value) || 1)),
              )
            }
            className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm font-mono tabular-nums text-[#20332B]"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="room-ventilation"
          className="block text-xs font-medium text-[#20332B] mb-1.5"
        >
          Current ventilation setup
        </label>
        <select
          id="room-ventilation"
          value={indoor.ventilation}
          onChange={(e) => {
            if (isOneOf(e.target.value, VENTILATION_OPTIONS)) {
              updateField('ventilation', e.target.value);
            }
          }}
          className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B]"
        >
          <option value="natural_windows">Natural window ventilation</option>
          <option value="closed">Mostly closed windows &amp; doors</option>
          <option value="exhaust_fans">Kitchen / bathroom exhaust fans</option>
          <option value="mechanical_hvac">Mechanical HVAC / filtered AC</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="cooking-fuel"
          className="block text-xs font-medium text-[#20332B] mb-1.5"
        >
          Cooking &amp; heating practice
        </label>
        <select
          id="cooking-fuel"
          value={indoor.cookingFuel}
          onChange={(e) => {
            if (isOneOf(e.target.value, COOKING_FUEL_OPTIONS)) {
              updateField('cookingFuel', e.target.value);
            }
          }}
          className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B]"
        >
          <option value="electric_induction">Electric / Induction</option>
          <option value="lpg_piped_gas">LPG / Piped Natural Gas</option>
          <option value="solid_biomass_coal">Biomass / Wood / Coal</option>
          <option value="mixed">Mixed fuels</option>
        </select>
      </div>

      <div className="space-y-3 border-t border-[#E1EAE4] pt-4">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-[#20332B] cursor-pointer">
          <input
            type="checkbox"
            checked={indoor.hasPurifier}
            onChange={(e) => {
              const checked = e.target.checked;
              onChange({
                ...indoor,
                hasPurifier: checked,
                filterType: checked
                  ? indoor.filterType === 'none'
                    ? 'true_hepa'
                    : indoor.filterType
                  : 'none',
              });
            }}
            className="h-4 w-4 accent-[#237A57]"
          />
          <span>Air purifier available in this room</span>
        </label>

        {indoor.hasPurifier && (
          <div>
            <label
              htmlFor="filter-type"
              className="block text-xs font-medium text-[#20332B] mb-1.5"
            >
              Filter type (if known)
            </label>
            <select
              id="filter-type"
              value={indoor.filterType}
              onChange={(e) => {
                if (isOneOf(e.target.value, FILTER_TYPE_OPTIONS)) {
                  updateField('filterType', e.target.value);
                }
              }}
              className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B]"
            >
              <option value="true_hepa">True HEPA (H13/H14)</option>
              <option value="hepa_carbon">True HEPA + Activated Carbon</option>
              <option value="basic_dust">Basic dust / mesh pre-filter</option>
              <option value="ionizer_ozone">Ionizer / Ozone generator</option>
              <option value="unknown">Not sure</option>
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-[#20332B] cursor-pointer">
          <input
            type="checkbox"
            checked={indoor.usesIncenseOrCandles}
            onChange={(e) => updateField('usesIncenseOrCandles', e.target.checked)}
            className="h-4 w-4 accent-[#237A57]"
          />
          <span>Regular incense, dhoop, or scented candles indoors</span>
        </label>

        <label className="flex items-center gap-2 text-sm text-[#20332B] cursor-pointer">
          <input
            type="checkbox"
            checked={indoor.indoorSmoking}
            onChange={(e) => updateField('indoorSmoking', e.target.checked)}
            className="h-4 w-4 accent-[#237A57]"
          />
          <span>Indoor tobacco smoke exposure</span>
        </label>
      </div>

      <fieldset className="border-t border-[#E1EAE4] pt-4 space-y-2">
        <legend className="text-xs font-medium text-[#20332B] mb-1">
          Nearby outdoor pollution sources
        </legend>
        {NEARBY_SOURCE_OPTIONS.map((src) => (
          <label
            key={src}
            className="flex items-center gap-2 text-sm text-[#20332B] cursor-pointer"
          >
            <input
              type="checkbox"
              checked={indoor.nearbySources.includes(src)}
              onChange={() => toggleNearbySource(src)}
              className="h-4 w-4 accent-[#237A57]"
            />
            <span>{src}</span>
          </label>
        ))}
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#E1EAE4] pt-4">
        <div>
          <label
            htmlFor="indoor-humidity"
            className="block text-xs font-medium text-[#20332B] mb-1.5"
          >
            Indoor humidity % (optional)
          </label>
          <input
            id="indoor-humidity"
            type="number"
            min={5}
            max={100}
            placeholder="Leave blank if unknown"
            value={indoor.indoorHumidityPercent ?? ''}
            onChange={(e) => {
              if (e.target.value === '') {
                updateField('indoorHumidityPercent', null);
                return;
              }
              const parsed = Number(e.target.value);
              if (Number.isFinite(parsed)) {
                updateField('indoorHumidityPercent', Math.max(5, Math.min(100, parsed)));
              }
            }}
            className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm font-mono tabular-nums text-[#20332B]"
          />
        </div>

        <div>
          <label
            htmlFor="indoor-sensor-pm25"
            className="block text-xs font-medium text-[#20332B] mb-1.5"
          >
            Indoor sensor PM2.5 µg/m³ (optional)
          </label>
          <input
            id="indoor-sensor-pm25"
            type="number"
            min={0}
            max={2000}
            placeholder="Only if you own a sensor"
            value={indoor.measuredIndoorPm25 ?? ''}
            onChange={(e) => {
              if (e.target.value === '') {
                updateField('measuredIndoorPm25', null);
                return;
              }
              const parsed = Number(e.target.value);
              if (Number.isFinite(parsed)) {
                updateField('measuredIndoorPm25', Math.max(0, Math.min(2000, parsed)));
              }
            }}
            className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm font-mono tabular-nums text-[#20332B]"
          />
        </div>
      </div>
    </section>
  );
}
