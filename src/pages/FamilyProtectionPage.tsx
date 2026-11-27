import { useState } from 'react';
import { CheckSquare, Plus, RotateCcw, Square, Trash2 } from 'lucide-react';
import { apiClient } from '../api/client.ts';
import { StructuredAIResponseCard } from '../components/StructuredAIResponseCard.tsx';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import type {
  AgeGroup,
  FamilyChecklistItem,
  HouseholdProfile,
  SensitivityConsideration,
  StructuredAIResponse,
} from '../types/index.ts';
import { interpretAqi } from '../utils/aqi.ts';
import { isOneOf } from '../utils/typeGuards.ts';

interface FamilyProtectionPageProps {
  state: BreatheWiseState;
}

const VENTILATION_SETUP_OPTIONS: readonly HouseholdProfile['ventilationSetup'][] = [
  'mixed',
  'natural_windows',
  'closed_ac',
  'purifier_assisted',
];

const CHECKLIST_AUDIENCES: readonly FamilyChecklistItem['audience'][] = [
  'household',
  'children',
  'older_adults',
  'sensitive',
  'outdoor_workers',
];

const AGE_GROUP_OPTIONS: Array<{ id: AgeGroup; label: string }> = [
  { id: 'children_under_12', label: 'Children (under 12)' },
  { id: 'teens', label: 'Teens (12–17)' },
  { id: 'adults', label: 'Adults (18–64)' },
  { id: 'older_adults_65_plus', label: 'Older adults (65+)' },
];

const SENSITIVITY_OPTIONS: Array<{ id: SensitivityConsideration; label: string }> = [
  {
    id: 'respiratory_sensitivity',
    label: 'Respiratory sensitivity (general — no medical records collected)',
  },
  { id: 'cardiovascular_sensitivity', label: 'Cardiovascular sensitivity' },
  { id: 'pregnancy', label: 'Pregnancy in household' },
  { id: 'outdoor_worker', label: 'Outdoor worker in household' },
  { id: 'school_commuter', label: 'Daily school / college commuter' },
];

export function FamilyProtectionPage({ state }: FamilyProtectionPageProps) {
  const { household, setHousehold, checklist, setChecklist, snapshot } = state;
  const [newTask, setNewTask] = useState('');
  const [newAudience, setNewAudience] =
    useState<FamilyChecklistItem['audience']>('household');
  const [aiBrief, setAiBrief] = useState<StructuredAIResponse | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const aqiInfo = interpretAqi(snapshot?.aqi, snapshot?.aqiScale ?? 'US_EPA');
  const isPolluted = !aqiInfo.outdoorExerciseSafe;

  const toggleAgeGroup = (group: AgeGroup) => {
    const exists = household.ageGroups.includes(group);
    setHousehold({
      ...household,
      ageGroups: exists
        ? household.ageGroups.filter((g) => g !== group)
        : [...household.ageGroups, group],
    });
  };

  const toggleSensitivity = (sens: SensitivityConsideration) => {
    const exists = household.sensitivities.includes(sens);
    setHousehold({
      ...household,
      sensitivities: exists
        ? household.sensitivities.filter((s) => s !== sens)
        : [...household.sensitivities, sens],
    });
  };

  const toggleChecklist = (id: string) => {
    setChecklist(
      checklist.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item,
      ),
    );
  };

  const addChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTask.trim();
    if (text.length < 3) return;
    setChecklist([
      ...checklist,
      {
        id: `chk-${Date.now()}`,
        text,
        audience: newAudience,
        completed: false,
      },
    ]);
    setNewTask('');
  };

  const handleAskFamilyBrief = async () => {
    setLoadingAi(true);
    setAiError(null);
    try {
      const response = await apiClient.askAssistant({
        question:
          'Generate a practical, non-diagnostic family air-quality protection plan for today tailored to our household age groups, commute patterns, and selected sensitivity considerations.',
        mode: 'family',
        snapshot,
        household,
      });
      setAiBrief(response);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Unable to generate family guidance.',
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
            Family Protection Mode
          </h1>
          <p className="text-sm text-[#66786E] mt-1">
            Practical household exposure-reduction planning for children, older adults,
            sensitive members, and outdoor workers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleAskFamilyBrief()}
          disabled={loadingAi}
          className="inline-flex items-center justify-center rounded-lg bg-[#237A57] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18543F] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          {loadingAi ? 'Generating Family Brief...' : 'Generate AI Family Brief'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Household Profile (Minimal Personal Data) */}
        <section
          aria-labelledby="household-profile-heading"
          className="lg:col-span-5 rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-5"
        >
          <div>
            <h2
              id="household-profile-heading"
              className="text-base font-semibold text-[#20332B]"
            >
              Household Profile
            </h2>
            <p className="text-xs text-[#66786E] mt-0.5">
              Stored only in your browser. No names, birth dates, addresses, or medical
              records are collected.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="member-count"
                className="block text-xs font-medium text-[#20332B] mb-1.5"
              >
                Household members
              </label>
              <input
                id="member-count"
                type="number"
                min={1}
                max={20}
                value={household.memberCount}
                onChange={(e) =>
                  setHousehold({
                    ...household,
                    memberCount: Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                  })
                }
                className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm font-mono tabular-nums text-[#20332B]"
              />
            </div>

            <div>
              <label
                htmlFor="home-ventilation"
                className="block text-xs font-medium text-[#20332B] mb-1.5"
              >
                Home ventilation
              </label>
              <select
                id="home-ventilation"
                value={household.ventilationSetup}
                onChange={(e) => {
                  if (isOneOf(e.target.value, VENTILATION_SETUP_OPTIONS)) {
                    setHousehold({
                      ...household,
                      ventilationSetup: e.target.value,
                    });
                  }
                }}
                className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B]"
              >
                <option value="mixed">Mixed natural &amp; fans</option>
                <option value="natural_windows">Natural windows only</option>
                <option value="closed_ac">Closed rooms / AC</option>
                <option value="purifier_assisted">HEPA purifier assisted</option>
              </select>
            </div>
          </div>

          <fieldset className="space-y-2 border-t border-[#E1EAE4] pt-4">
            <legend className="text-xs font-medium text-[#20332B] mb-1">
              General age groups in household
            </legend>
            {AGE_GROUP_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 text-sm text-[#20332B] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={household.ageGroups.includes(opt.id)}
                  onChange={() => toggleAgeGroup(opt.id)}
                  className="h-4 w-4 accent-[#237A57]"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-2 border-t border-[#E1EAE4] pt-4">
            <legend className="text-xs font-medium text-[#20332B] mb-1">
              Optional exposure-sensitivity considerations
            </legend>
            {SENSITIVITY_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex items-start gap-2 text-sm text-[#20332B] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={household.sensitivities.includes(opt.id)}
                  onChange={() => toggleSensitivity(opt.id)}
                  className="h-4 w-4 accent-[#237A57] mt-0.5"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-2 border-t border-[#E1EAE4] pt-4">
            <legend className="text-xs font-medium text-[#20332B] mb-1">
              Typical commute &amp; outdoor patterns
            </legend>
            {[
              'Public transit / Metro',
              'School or college bus',
              'Two-wheeler / open commute',
              'Morning or evening walks',
              'Outdoor sports or playground',
            ].map((pattern) => {
              const active = household.commutePatterns.includes(pattern);
              return (
                <label
                  key={pattern}
                  className="flex items-center gap-2 text-sm text-[#20332B] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() =>
                      setHousehold({
                        ...household,
                        commutePatterns: active
                          ? household.commutePatterns.filter((p) => p !== pattern)
                          : [...household.commutePatterns, pattern],
                      })
                    }
                    className="h-4 w-4 accent-[#237A57]"
                  />
                  <span>{pattern}</span>
                </label>
              );
            })}
          </fieldset>
        </section>

        {/* Right: Tailored Group Guidance + Daily Checklist */}
        <div className="lg:col-span-7 space-y-5">
          {aiError && (
            <div
              role="alert"
              className="rounded-xl border border-[#C94D53]/40 bg-[#FBECEE] p-4 text-sm text-[#962D32]"
            >
              {aiError}
            </div>
          )}

          {aiBrief && (
            <section className="rounded-xl border border-[#237A57]/40 bg-white p-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[#18543F]">
                  Gemini Family Protection Brief
                </h2>
                <button
                  type="button"
                  onClick={() => setAiBrief(null)}
                  className="text-xs text-[#66786E] hover:text-[#20332B]"
                >
                  Dismiss
                </button>
              </div>
              <StructuredAIResponseCard response={aiBrief} />
            </section>
          )}

          {/* Special Consideration Guidance Cards */}
          <section
            aria-labelledby="special-groups-heading"
            className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="special-groups-heading"
                className="text-base font-semibold text-[#20332B]"
              >
                Tailored Exposure-Reduction Considerations
              </h2>
              <span className="text-xs text-[#66786E]">
                Current AQI: {snapshot?.aqi ?? 'Unavailable'} ({aqiInfo.label})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] p-4 space-y-1.5">
                <h3 className="text-sm font-semibold text-[#20332B]">Children</h3>
                <p className="text-xs text-[#66786E] leading-relaxed">
                  {isPolluted
                    ? 'Developing lungs breathe faster relative to body weight. Shift active sports indoors today, limit roadside waiting at school gates, and ensure indoor play spaces stay smoke-free.'
                    : 'Current air quality allows normal outdoor play; prefer parks set back from congested roads and recheck AQI before evening.'}
                </p>
              </div>

              <div className="rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] p-4 space-y-1.5">
                <h3 className="text-sm font-semibold text-[#20332B]">
                  Older Adults (65+)
                </h3>
                <p className="text-xs text-[#66786E] leading-relaxed">
                  {isPolluted
                    ? 'Avoid early-morning outdoor walks during winter smog inversions. Keep indoor rooms comfortably filtered, have others handle errands, and seek prompt medical advice if shortness of breath or chest discomfort occurs.'
                    : 'Light outdoor walks are reasonable under current readings; carry prescribed medications and check afternoon/evening trends.'}
                </p>
              </div>

              <div className="rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] p-4 space-y-1.5">
                <h3 className="text-sm font-semibold text-[#20332B]">
                  Respiratory &amp; Cardiovascular Sensitivities
                </h3>
                <p className="text-xs text-[#66786E] leading-relaxed">
                  Follow your clinician’s existing action plan and keep prescribed
                  reliever medications accessible. Reduce exertion during elevated
                  PM2.5/O3 and seek medical care promptly for worsening symptoms.
                </p>
              </div>

              <div className="rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] p-4 space-y-1.5">
                <h3 className="text-sm font-semibold text-[#20332B]">Outdoor Workers</h3>
                <p className="text-xs text-[#66786E] leading-relaxed">
                  {isPolluted
                    ? 'Use a well-fitted N95/FFP2 respirator during high-particulate shifts, schedule indoor recovery breaks, stay hydrated, and shift heavy manual work away from peak traffic hours where feasible.'
                    : 'Keep particulate protection available if localized dust, road work, or smoke appears on-site.'}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#66786E]">
              Note: BreatheWise AI provides general exposure-reduction education and does
              not diagnose or predict medical conditions.
            </p>
          </section>

          {/* Daily Household Checklist */}
          <section
            aria-labelledby="family-checklist-heading"
            className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2
                  id="family-checklist-heading"
                  className="text-base font-semibold text-[#20332B]"
                >
                  Daily Household Checklist
                </h2>
                <p className="text-xs text-[#66786E]">
                  {checklist.filter((c) => c.completed).length} of {checklist.length}{' '}
                  completed today
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setChecklist(checklist.map((c) => ({ ...c, completed: false })))
                }
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#66786E] hover:text-[#20332B]"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset Today</span>
              </button>
            </div>

            <ul className="divide-y divide-[#E1EAE4]">
              {checklist.map((item) => (
                <li key={item.id} className="py-3 flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleChecklist(item.id)}
                    aria-pressed={item.completed}
                    className="flex items-start gap-3 text-left flex-1 group"
                  >
                    {item.completed ? (
                      <CheckSquare
                        className="w-4 h-4 text-[#237A57] mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <Square
                        className="w-4 h-4 text-[#66786E] group-hover:text-[#237A57] mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <div>
                      <span
                        className={`text-sm ${
                          item.completed
                            ? 'line-through text-[#66786E]'
                            : 'text-[#20332B]'
                        }`}
                      >
                        {item.text}
                      </span>
                      <span className="block text-[11px] text-[#66786E] capitalize">
                        Focus: {item.audience.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setChecklist(checklist.filter((c) => c.id !== item.id))
                    }
                    aria-label={`Delete checklist item: ${item.text}`}
                    className="text-[#66786E] hover:text-[#C94D53] p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            <form
              onSubmit={addChecklistItem}
              className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-[#E1EAE4]"
            >
              <label htmlFor="new-checklist-item" className="sr-only">
                Add daily checklist item
              </label>
              <input
                id="new-checklist-item"
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Add a daily family step..."
                className="flex-1 rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3.5 py-2 text-sm text-[#20332B] focus:bg-white focus:border-[#237A57] focus:outline-none"
              />
              <select
                aria-label="Audience for checklist item"
                value={newAudience}
                onChange={(e) => {
                  if (isOneOf(e.target.value, CHECKLIST_AUDIENCES)) {
                    setNewAudience(e.target.value);
                  }
                }}
                className="rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B]"
              >
                <option value="household">Whole Household</option>
                <option value="children">Children</option>
                <option value="older_adults">Older Adults</option>
                <option value="sensitive">Sensitive Members</option>
                <option value="outdoor_workers">Outdoor Workers</option>
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#18543F] px-4 py-2 text-sm font-medium text-white hover:bg-[#237A57] transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Add</span>
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
