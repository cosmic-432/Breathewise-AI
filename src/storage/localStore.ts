import type {
  AirQualitySnapshot,
  ChatTurn,
  FamilyChecklistItem,
  HistoricalAqiRecord,
  HouseholdProfile,
  IndoorConditions,
  LocationSelection,
  RecordedImpactAction,
  RoutineActivity,
} from '../types/index.ts';

export const STORAGE_KEYS = {
  location: 'breathewise:location:v1',
  household: 'breathewise:household:v1',
  routines: 'breathewise:routines:v1',
  indoor: 'breathewise:indoor:v1',
  checklist: 'breathewise:checklist:v1',
  impactActions: 'breathewise:impact_actions:v1',
  aqiHistory: 'breathewise:aqi_history:v1',
  chatHistory: 'breathewise:chat:v1',
  communityJoined: 'breathewise:community_joined:v1',
  clientToken: 'breathewise:client_token:v1',
} as const;

export const DEFAULT_LOCATION: LocationSelection = {
  id: 'in-delhi-cp',
  name: 'New Delhi',
  neighborhood: 'Connaught Place / Central',
  region: 'Delhi',
  country: 'India',
  countryCode: 'IN',
  latitude: 28.6315,
  longitude: 77.2167,
  source: 'preset',
};

export const DEFAULT_HOUSEHOLD: HouseholdProfile = {
  memberCount: 4,
  ageGroups: ['adults', 'older_adults_65_plus'],
  outdoorActivities: ['Morning walk', 'College commute'],
  commutePatterns: ['Public transit / Metro', 'Occasional car errands'],
  ventilationSetup: 'mixed',
  sensitivities: ['school_commuter'],
  preferredUnitSystem: 'metric',
  regionGrid: 'india',
};

export const DEFAULT_ROUTINES: RoutineActivity[] = [
  {
    id: 'rt-morning-commute',
    title: 'College / Office Commute',
    category: 'school_college_commute',
    preferredBlock: 'morning',
    durationMinutes: 45,
    isOutdoor: true,
    currentTransport: 'public_transit',
  },
  {
    id: 'rt-evening-walk',
    title: 'Evening Walk / Exercise',
    category: 'exercise',
    preferredBlock: 'evening',
    durationMinutes: 35,
    isOutdoor: true,
    currentTransport: 'walk_cycle',
  },
  {
    id: 'rt-groceries',
    title: 'Weekly Grocery & Pharmacy Errands',
    category: 'shopping',
    preferredBlock: 'afternoon',
    durationMinutes: 40,
    isOutdoor: true,
    currentTransport: 'car_solo',
  },
];

export const DEFAULT_INDOOR: IndoorConditions = {
  roomSizeSqm: 24,
  occupants: 3,
  ventilation: 'natural_windows',
  nearbySources: ['Busy main road nearby'],
  hasPurifier: false,
  filterType: 'none',
  indoorHumidityPercent: null,
  cookingFuel: 'lpg_piped_gas',
  usesIncenseOrCandles: false,
  indoorSmoking: false,
  measuredIndoorPm25: null,
  sensorLabel: '',
};

export const DEFAULT_CHECKLIST: FamilyChecklistItem[] = [
  {
    id: 'chk-1',
    text: 'Check local AQI and short-term trend before morning departure',
    audience: 'household',
    completed: false,
  },
  {
    id: 'chk-2',
    text: 'Close road-facing windows during morning and evening smog peaks',
    audience: 'household',
    completed: false,
  },
  {
    id: 'chk-3',
    text: 'Keep well-fitted N95/FFP2 masks ready for essential commutes when AQI is Poor+',
    audience: 'sensitive',
    completed: false,
  },
  {
    id: 'chk-4',
    text: 'Move children’s active outdoor play indoors when AQI enters elevated categories',
    audience: 'children',
    completed: false,
  },
  {
    id: 'chk-5',
    text: 'Ensure older adults avoid strenuous outdoor errands during haze and keep prescribed inhalers/medicines nearby',
    audience: 'older_adults',
    completed: false,
  },
];

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors gracefully
  }
}

export const localStore = {
  getLocation: (): LocationSelection =>
    safeRead<LocationSelection>(STORAGE_KEYS.location, DEFAULT_LOCATION),
  setLocation: (loc: LocationSelection): void =>
    safeWrite(STORAGE_KEYS.location, loc),

  getHousehold: (): HouseholdProfile =>
    safeRead<HouseholdProfile>(STORAGE_KEYS.household, DEFAULT_HOUSEHOLD),
  setHousehold: (profile: HouseholdProfile): void =>
    safeWrite(STORAGE_KEYS.household, profile),

  getRoutines: (): RoutineActivity[] =>
    safeRead<RoutineActivity[]>(STORAGE_KEYS.routines, DEFAULT_ROUTINES),
  setRoutines: (items: RoutineActivity[]): void =>
    safeWrite(STORAGE_KEYS.routines, items),

  getIndoor: (): IndoorConditions =>
    safeRead<IndoorConditions>(STORAGE_KEYS.indoor, DEFAULT_INDOOR),
  setIndoor: (cond: IndoorConditions): void =>
    safeWrite(STORAGE_KEYS.indoor, cond),

  getChecklist: (): FamilyChecklistItem[] =>
    safeRead<FamilyChecklistItem[]>(STORAGE_KEYS.checklist, DEFAULT_CHECKLIST),
  setChecklist: (items: FamilyChecklistItem[]): void =>
    safeWrite(STORAGE_KEYS.checklist, items),

  getImpactActions: (): RecordedImpactAction[] =>
    safeRead<RecordedImpactAction[]>(STORAGE_KEYS.impactActions, []),
  setImpactActions: (items: RecordedImpactAction[]): void =>
    safeWrite(STORAGE_KEYS.impactActions, items),

  getAqiHistory: (): HistoricalAqiRecord[] =>
    safeRead<HistoricalAqiRecord[]>(STORAGE_KEYS.aqiHistory, []),

  /**
   * Appends ONLY real retrieved AQI snapshots (never fabricates historical entries).
   * Deduplicates snapshots for the same location within a 15-minute window.
   */
  recordVerifiedAqiSnapshot: (snapshot: AirQualitySnapshot): HistoricalAqiRecord[] => {
    const current = localStore.getAqiHistory();
    if (snapshot.aqi === null || snapshot.aqiStatus === 'unavailable') {
      return current;
    }

    const nowMs = Date.now();
    const latestSameLoc = current.find(
      (item) => item.locationId === snapshot.location.id,
    );
    if (latestSameLoc) {
      const prevMs = Date.parse(latestSameLoc.recordedAt);
      if (!Number.isNaN(prevMs) && nowMs - prevMs < 15 * 60 * 1000) {
        return current;
      }
    }

    const pm25 =
      snapshot.pollutants.find((p) => p.code === 'PM2.5')?.value ?? null;
    const pm10 =
      snapshot.pollutants.find((p) => p.code === 'PM10')?.value ?? null;
    const no2 =
      snapshot.pollutants.find((p) => p.code === 'NO2')?.value ?? null;

    const record: HistoricalAqiRecord = {
      id: `hist-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
      recordedAt: snapshot.lastUpdated ?? snapshot.fetchedAt,
      locationId: snapshot.location.id,
      locationName: snapshot.location.neighborhood
        ? `${snapshot.location.name} (${snapshot.location.neighborhood})`
        : snapshot.location.name,
      aqi: snapshot.aqi,
      pm25,
      pm10,
      no2,
      dataSource: snapshot.dataSource,
      status: snapshot.aqiStatus,
    };

    const next = [record, ...current].slice(0, 120);
    safeWrite(STORAGE_KEYS.aqiHistory, next);
    return next;
  },

  getChatHistory: (): ChatTurn[] =>
    safeRead<ChatTurn[]>(STORAGE_KEYS.chatHistory, []),
  setChatHistory: (turns: ChatTurn[]): void =>
    safeWrite(STORAGE_KEYS.chatHistory, turns.slice(-24)),

  getJoinedChallenges: (): string[] =>
    safeRead<string[]>(STORAGE_KEYS.communityJoined, []),
  setJoinedChallenges: (ids: string[]): void =>
    safeWrite(STORAGE_KEYS.communityJoined, ids),

  getOrCreateClientToken: (): string => {
    const existing = safeRead<string>(STORAGE_KEYS.clientToken, '');
    if (existing && existing.length >= 12) return existing;
    const bytes = new Uint8Array(12);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    safeWrite(STORAGE_KEYS.clientToken, token);
    return token;
  },

  exportAllUserData: (): string => {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        location: localStore.getLocation(),
        household: localStore.getHousehold(),
        routines: localStore.getRoutines(),
        indoor: localStore.getIndoor(),
        checklist: localStore.getChecklist(),
        impactActions: localStore.getImpactActions(),
        aqiHistory: localStore.getAqiHistory(),
      },
      null,
      2,
    );
  },

  clearAllUserData: (): void => {
    if (typeof window === 'undefined') return;
    Object.values(STORAGE_KEYS).forEach((k) => {
      window.localStorage.removeItem(k);
    });
  },
};
