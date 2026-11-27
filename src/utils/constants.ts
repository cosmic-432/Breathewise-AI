import type { HouseholdProfile } from '../types/index.ts';

export const REGION_GRID_OPTIONS: ReadonlyArray<{
  value: HouseholdProfile['regionGrid'];
  shortLabel: string;
  detailedLabel: string;
}> = [
  {
    value: 'india',
    shortLabel: 'India (CEA 0.727)',
    detailedLabel: 'India — CEA v19 (0.727 kg CO2/kWh)',
  },
  {
    value: 'global',
    shortLabel: 'Global Avg (0.436)',
    detailedLabel: 'Global Average — IEA (0.436 kg CO2/kWh)',
  },
  {
    value: 'us',
    shortLabel: 'US eGRID (0.373)',
    detailedLabel: 'United States — EPA eGRID (0.373 kg CO2/kWh)',
  },
  {
    value: 'eu',
    shortLabel: 'EU EEA (0.242)',
    detailedLabel: 'European Union — EEA (0.242 kg CO2/kWh)',
  },
];

export const REGION_GRID_VALUES: readonly HouseholdProfile['regionGrid'][] =
  REGION_GRID_OPTIONS.map((opt) => opt.value);
