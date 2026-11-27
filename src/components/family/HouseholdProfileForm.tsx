import type {
  AgeGroup,
  HouseholdProfile,
  SensitivityConsideration,
} from '../../types/index.ts';
import { isOneOf } from '../../utils/typeGuards.ts';

const VENTILATION_SETUP_OPTIONS: readonly HouseholdProfile['ventilationSetup'][] = [
  'mixed',
  'natural_windows',
  'closed_ac',
  'purifier_assisted',
];

const AGE_GROUP_OPTIONS: ReadonlyArray<{ id: AgeGroup; label: string }> = [
  { id: 'children_under_12', label: 'Children (under 12)' },
  { id: 'teens', label: 'Teens (12–17)' },
  { id: 'adults', label: 'Adults (18–64)' },
  { id: 'older_adults_65_plus', label: 'Older adults (65+)' },
];

const SENSITIVITY_OPTIONS: ReadonlyArray<{
  id: SensitivityConsideration;
  label: string;
}> = [
  {
    id: 'respiratory_sensitivity',
    label: 'Respiratory sensitivity (general — no medical records collected)',
  },
  { id: 'cardiovascular_sensitivity', label: 'Cardiovascular sensitivity' },
  { id: 'pregnancy', label: 'Pregnancy in household' },
  { id: 'outdoor_worker', label: 'Outdoor worker in household' },
  { id: 'school_commuter', label: 'Daily school / college commuter' },
];

const COMMUTE_PATTERN_OPTIONS = [
  'Public transit / Metro',
  'School or college bus',
  'Two-wheeler / open commute',
  'Morning or evening walks',
  'Outdoor sports or playground',
] as const;

interface HouseholdProfileFormProps {
  household: HouseholdProfile;
  onChange: (next: HouseholdProfile) => void;
}

export function HouseholdProfileForm({ household, onChange }: HouseholdProfileFormProps) {
  const toggleAgeGroup = (group: AgeGroup) => {
    const exists = household.ageGroups.includes(group);
    onChange({
      ...household,
      ageGroups: exists
        ? household.ageGroups.filter((g) => g !== group)
        : [...household.ageGroups, group],
    });
  };

  const toggleSensitivity = (sens: SensitivityConsideration) => {
    const exists = household.sensitivities.includes(sens);
    onChange({
      ...household,
      sensitivities: exists
        ? household.sensitivities.filter((s) => s !== sens)
        : [...household.sensitivities, sens],
    });
  };

  return (
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
        <p className="text-xs text-[#52645A] mt-0.5">
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
              onChange({
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
                onChange({
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
        {COMMUTE_PATTERN_OPTIONS.map((pattern) => {
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
                  onChange({
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
  );
}
