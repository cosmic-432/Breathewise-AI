import type { ActivityCategory, RoutineActivity, TimeBlock } from '../../types/index.ts';

export const ACTIVITY_LABELS: Record<ActivityCategory, string> = {
  school_college_commute: 'School / College Commute',
  office_commute: 'Office Commute',
  shopping: 'Shopping / Errands',
  exercise: 'Exercise / Sports',
  outdoor_work: 'Outdoor Work',
  walking: 'Walking',
  family_activities: 'Family Activities',
  other: 'Other Activity',
};

export const ACTIVITY_CATEGORIES: readonly ActivityCategory[] = [
  'school_college_commute',
  'office_commute',
  'shopping',
  'exercise',
  'outdoor_work',
  'walking',
  'family_activities',
  'other',
];

export const TIME_BLOCKS: ReadonlyArray<{
  id: TimeBlock;
  label: string;
  hours: string;
}> = [
  { id: 'morning', label: 'Morning', hours: '06:00 – 11:59' },
  { id: 'afternoon', label: 'Afternoon', hours: '12:00 – 16:59' },
  { id: 'evening', label: 'Evening', hours: '17:00 – 20:59' },
  { id: 'night', label: 'Night', hours: '21:00 – 23:59' },
];

export const TIME_BLOCK_IDS: readonly TimeBlock[] = TIME_BLOCKS.map((b) => b.id);

export type TransportMode = NonNullable<RoutineActivity['currentTransport']>;

export const TRANSPORT_MODES: readonly TransportMode[] = [
  'public_transit',
  'car_solo',
  'carpool',
  'two_wheeler',
  'walk_cycle',
  'none',
];
