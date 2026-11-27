export type DataQualityStatus = 'measured' | 'estimated' | 'unavailable';

export type FreshnessStatus = 'live' | 'recent' | 'stale' | 'unavailable';

export type AqiScale = 'US_EPA' | 'INDIA_NAQI';

export type AqiCategoryId =
  | 'good'
  | 'moderate'
  | 'sensitive'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous'
  | 'unavailable';

export interface PollutantReading {
  code: 'PM2.5' | 'PM10' | 'NO2' | 'SO2' | 'CO' | 'O3';
  label: string;
  value: number | null;
  unit: 'µg/m³' | 'mg/m³';
  status: DataQualityStatus;
  note?: string;
}

export interface WeatherReading {
  temperatureC: number | null;
  humidityPercent: number | null;
  windSpeedKmh: number | null;
  status: DataQualityStatus;
  source: string;
  timestamp: string | null;
}

export interface HourlyAqiPoint {
  time: string;
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  status: DataQualityStatus;
}

export interface LocationSelection {
  id: string;
  name: string;
  neighborhood?: string;
  region?: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  source: 'preset' | 'search' | 'geolocation';
}

export interface AirQualitySnapshot {
  location: LocationSelection;
  aqi: number | null;
  aqiScale: AqiScale;
  aqiStatus: DataQualityStatus;
  dominantPollutant: string | null;
  pollutants: PollutantReading[];
  weather: WeatherReading;
  hourlyForecast: HourlyAqiPoint[];
  trend: 'improving' | 'worsening' | 'stable' | 'unavailable';
  trendSummary: string;
  dataSource: string;
  providerId: string;
  stationName?: string;
  lastUpdated: string | null;
  fetchedAt: string;
  cached: boolean;
  cacheMaxAgeSeconds: number;
  freshness: FreshnessStatus;
  notice?: string;
}

export type ActivityCategory =
  | 'school_college_commute'
  | 'office_commute'
  | 'shopping'
  | 'exercise'
  | 'outdoor_work'
  | 'walking'
  | 'family_activities'
  | 'other';

export type TimeBlock = 'morning' | 'afternoon' | 'evening' | 'night';

export interface RoutineActivity {
  id: string;
  title: string;
  category: ActivityCategory;
  preferredBlock: TimeBlock;
  durationMinutes: number;
  isOutdoor: boolean;
  currentTransport?: 'car_solo' | 'carpool' | 'two_wheeler' | 'public_transit' | 'walk_cycle' | 'none';
  notes?: string;
}

export interface RoutineRecommendation {
  activityId: string;
  recommendedTiming: string;
  exposureLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'unknown';
  exposureConsiderations: string;
  lowerExposureAlternatives: string[];
  sustainableTransportOptions: string[];
  practicalActions: string[];
  reasoning: string;
  healthOverEmissionsNote?: string;
  basedOnForecast: boolean;
}

export interface IndoorConditions {
  roomSizeSqm: number;
  occupants: number;
  ventilation: 'closed' | 'natural_windows' | 'exhaust_fans' | 'mechanical_hvac';
  nearbySources: string[];
  hasPurifier: boolean;
  filterType: 'none' | 'true_hepa' | 'hepa_carbon' | 'basic_dust' | 'ionizer_ozone' | 'unknown';
  indoorHumidityPercent?: number | null;
  cookingFuel: 'electric_induction' | 'lpg_piped_gas' | 'solid_biomass_coal' | 'mixed';
  usesIncenseOrCandles: boolean;
  indoorSmoking: boolean;
  measuredIndoorPm25?: number | null;
  sensorLabel?: string;
}

export interface IndoorAdviceResult {
  measuredSection: {
    hasSensorData: boolean;
    summary: string;
    pm25Value: number | null;
    sensorLabel?: string;
  };
  reportedConditionsSummary: string[];
  recommendedCadrM3h: number;
  ventilationStrategy: string;
  priorityActions: Array<{
    title: string;
    detail: string;
    category: 'ventilation' | 'source_control' | 'filtration' | 'humidity';
  }>;
  purifierGuidance: string;
  ozoneWarning: boolean;
}

export type AgeGroup = 'children_under_12' | 'teens' | 'adults' | 'older_adults_65_plus';

export type SensitivityConsideration =
  | 'respiratory_sensitivity'
  | 'cardiovascular_sensitivity'
  | 'pregnancy'
  | 'outdoor_worker'
  | 'school_commuter';

export interface HouseholdProfile {
  memberCount: number;
  ageGroups: AgeGroup[];
  outdoorActivities: string[];
  commutePatterns: string[];
  ventilationSetup: 'closed_ac' | 'natural_windows' | 'mixed' | 'purifier_assisted';
  sensitivities: SensitivityConsideration[];
  preferredUnitSystem: 'metric' | 'imperial';
  regionGrid: 'india' | 'global' | 'us' | 'eu';
}

export interface FamilyChecklistItem {
  id: string;
  text: string;
  audience: 'household' | 'children' | 'older_adults' | 'sensitive' | 'outdoor_workers';
  completed: boolean;
}

export type ImpactActionType =
  | 'carpool'
  | 'combine_errands'
  | 'public_transit'
  | 'electricity_reduction'
  | 'avoid_waste_burning'
  | 'cleaner_cooking';

export interface RecordedImpactAction {
  id: string;
  type: ImpactActionType;
  label: string;
  dateIso: string;
  quantity: number;
  unit: string;
  co2AvoidedKg: number | null;
  fuelSavedLiters: number | null;
  tripsReduced: number;
  kwhSaved: number | null;
  regionGrid: HouseholdProfile['regionGrid'];
  notes?: string;
}

export interface ImpactCalculationResult {
  actionType: ImpactActionType;
  quantifiable: boolean;
  co2AvoidedKg: number | null;
  fuelSavedLiters: number | null;
  tripsReduced: number;
  kwhSaved: number | null;
  beforeScenario: string;
  afterScenario: string;
  beforeCo2Kg: number | null;
  afterCo2Kg: number | null;
  units: string;
  assumptions: string[];
  emissionFactorLabel: string;
  dataSource: string;
  uncertainty: string;
  localPollutantDistinction: string;
  educationalNote?: string;
}

export interface SustainableAlternativeItem {
  id: string;
  category: 'transportation' | 'household' | 'community';
  title: string;
  currentHabit: string;
  suggestedAlternative: string;
  whyItMatters: string;
  practicalImplementation: string[];
  potentialBenefit: string;
  tradeOffsAndLimitations: string;
  requiresSafeOutdoorAir?: boolean;
}

export interface StructuredAIResponse {
  summary: string;
  air_quality_context: {
    location: string;
    aqi_value: number | null;
    aqi_category: string;
    data_status: string;
    data_source: string;
    last_updated: string;
  };
  recommendations: Array<{
    title: string;
    action: string;
    basis: 'verified_data' | 'general_guidance';
  }>;
  indoor_actions: string[];
  outdoor_actions: string[];
  sustainable_alternatives: string[];
  impact_explanation: string[];
  limitations: string[];
  sources: string[];
}

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  structured?: StructuredAIResponse;
  createdAt: string;
  error?: string;
}

export interface CommunityChallenge {
  id: string;
  title: string;
  category: 'transport' | 'errands' | 'waste' | 'energy';
  description: string;
  goalDescription: string;
  participantsCount: number;
  actionsLoggedCount: number;
  verifiedNotice: string;
}

export interface CommunityReport {
  id: string;
  areaLabel: string;
  category: 'tip' | 'initiative' | 'observation';
  title: string;
  description: string;
  createdAt: string;
  unverifiedUserReport: true;
}

export interface HistoricalAqiRecord {
  id: string;
  recordedAt: string;
  locationId: string;
  locationName: string;
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  dataSource: string;
  status: DataQualityStatus;
}

export type NavSection =
  | 'overview'
  | 'assistant'
  | 'map'
  | 'planner'
  | 'indoor'
  | 'family'
  | 'sustainable'
  | 'impact'
  | 'community'
  | 'history'
  | 'settings';
