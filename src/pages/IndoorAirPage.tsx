import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiClient } from '../api/client.ts';
import { StructuredAIResponseCard } from '../components/StructuredAIResponseCard.tsx';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import type { IndoorConditions, StructuredAIResponse } from '../types/index.ts';
import { evaluateIndoorAir } from '../utils/indoorAdvisor.ts';
import { isOneOf } from '../utils/typeGuards.ts';

interface IndoorAirPageProps {
  state: BreatheWiseState;
}

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
];

export function IndoorAirPage({ state }: IndoorAirPageProps) {
  const { indoor, setIndoor, snapshot, household } = state;
  const [aiAdvice, setAiAdvice] = useState<StructuredAIResponse | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const baseline = useMemo(() => evaluateIndoorAir(indoor, snapshot), [indoor, snapshot]);

  const updateField = <K extends keyof IndoorConditions>(
    key: K,
    value: IndoorConditions[K],
  ) => {
    setIndoor({ ...indoor, [key]: value });
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

  const handleRequestAiIndoorAdvice = async () => {
    setLoadingAi(true);
    setAiError(null);
    try {
      const response = await apiClient.askAssistant({
        question:
          'Give practical indoor air quality recommendations for my room conditions and current outdoor AQI, including ventilation timing, cooking exhaust, dust control, and air purifier sizing without inventing any indoor sensor measurements.',
        mode: 'indoor',
        snapshot,
        household,
        indoor,
      });
      setAiAdvice(response);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Unable to generate AI indoor guidance.',
      );
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#20332B]">
            Indoor Air Quality Advisor
          </h1>
          <p className="text-sm text-[#66786E] mt-1">
            Ventilation timing, source control, and purifier sizing separated cleanly into
            measured data, reported room conditions, and AI guidance.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRequestAiIndoorAdvice()}
          disabled={loadingAi}
          className="inline-flex items-center justify-center rounded-lg bg-[#237A57] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18543F] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          {loadingAi ? 'Generating AI Guidance...' : 'Get AI Indoor Plan'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: User-Reported Conditions Form */}
        <section
          aria-labelledby="indoor-form-heading"
          className="lg:col-span-5 rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-5"
        >
          <div>
            <h2
              id="indoor-form-heading"
              className="text-base font-semibold text-[#20332B]"
            >
              Your Home &amp; Room Conditions
            </h2>
            <p className="text-xs text-[#66786E] mt-0.5">
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
                  updateField('roomSizeSqm', Math.max(4, Number(e.target.value) || 4))
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
                  updateField('occupants', Math.max(1, Number(e.target.value) || 1))
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
                  setIndoor({
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
                onChange={(e) =>
                  updateField(
                    'indoorHumidityPercent',
                    e.target.value === '' ? null : Number(e.target.value),
                  )
                }
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
                onChange={(e) =>
                  updateField(
                    'measuredIndoorPm25',
                    e.target.value === '' ? null : Number(e.target.value),
                  )
                }
                className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm font-mono tabular-nums text-[#20332B]"
              />
            </div>
          </div>
        </section>

        {/* Right: Strictly Separated Measured vs Reported vs Recommendations */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Measured Indoor Data */}
          <section
            aria-labelledby="measured-indoor-heading"
            className="rounded-xl border border-[#E1EAE4] bg-white p-5 space-y-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2
                id="measured-indoor-heading"
                className="text-sm font-semibold text-[#20332B]"
              >
                1. Measured Indoor Air Quality
              </h2>
              <span className="text-xs text-[#66786E]">
                {baseline.measuredSection.hasSensorData
                  ? 'User sensor reading'
                  : 'No sensor connected'}
              </span>
            </div>
            <p className="text-sm text-[#20332B]/90 leading-relaxed">
              {baseline.measuredSection.summary}
            </p>
          </section>

          {/* 2. Reported Conditions & Ventilation Strategy */}
          <section
            aria-labelledby="reported-indoor-heading"
            className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-5"
          >
            <div>
              <h2
                id="reported-indoor-heading"
                className="text-sm font-semibold text-[#20332B]"
              >
                2. User-Reported Conditions &amp; Baseline Guidance
              </h2>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#66786E]">
                {baseline.reportedConditionsSummary.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            </div>

            {baseline.ozoneWarning && (
              <div
                role="alert"
                className="rounded-lg border border-[#C94D53]/40 bg-[#FBECEE] p-4 flex items-start gap-3 text-sm text-[#962D32]"
              >
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Avoid ozone-generating air cleaners</p>
                  <p className="mt-0.5 text-xs leading-relaxed">
                    Ozone irritates lungs and can worsen respiratory symptoms. Switch to a
                    mechanical True HEPA purifier that does not generate ozone.
                  </p>
                </div>
              </div>
            )}

            <div className="border-t border-[#E1EAE4] pt-4 space-y-1.5">
              <h3 className="text-xs font-semibold text-[#18543F]">
                Ventilation Strategy (Outdoor AQI-Aware)
              </h3>
              <p className="text-sm text-[#20332B] leading-relaxed">
                {baseline.ventilationStrategy}
              </p>
            </div>

            <div className="border-t border-[#E1EAE4] pt-4 space-y-3">
              <h3 className="text-xs font-semibold text-[#18543F]">
                Priority Indoor Actions
              </h3>
              <ul className="space-y-3">
                {baseline.priorityActions.map((act) => (
                  <li key={act.title} className="space-y-0.5">
                    <p className="text-sm font-semibold text-[#20332B]">{act.title}</p>
                    <p className="text-sm text-[#66786E] leading-relaxed">{act.detail}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-[#E1EAE4] pt-4 space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xs font-semibold text-[#18543F]">
                  General Air Purifier Sizing Guidance
                </h3>
                <span className="text-xs font-mono tabular-nums font-semibold text-[#237A57]">
                  Target CADR ≈ {baseline.recommendedCadrM3h} m³/h
                </span>
              </div>
              <p className="text-sm text-[#66786E] leading-relaxed">
                {baseline.purifierGuidance}
              </p>
            </div>
          </section>

          {/* 3. AI-Generated Recommendations */}
          <section
            aria-labelledby="ai-indoor-heading"
            className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="ai-indoor-heading" className="text-sm font-semibold text-[#20332B]">
                3. AI-Generated Personalized Indoor Guidance
              </h2>
              <span className="text-xs text-[#66786E]">Powered by Gemini</span>
            </div>

            {aiError && (
              <div
                role="alert"
                className="rounded-lg border border-[#C94D53]/40 bg-[#FBECEE] px-4 py-3 text-xs text-[#962D32]"
              >
                {aiError}
              </div>
            )}

            {aiAdvice ? (
              <StructuredAIResponseCard response={aiAdvice} />
            ) : (
              <p className="text-sm text-[#66786E]">
                Click &ldquo;Get AI Indoor Plan&rdquo; above to receive a tailored
                room-by-room indoor air checklist combining your reported room details
                with today’s outdoor air quality.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
