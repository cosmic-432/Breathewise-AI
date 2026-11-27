import { z } from 'zod';
import {
  householdProfileSchema,
  indoorConditionsSchema,
  routineActivitySchema,
  structuredAIResponseSchema,
} from './index.ts';

/**
 * Runtime validation schemas for browser localStorage entries and backend API responses.
 * Prevents corrupted, tampered, or outdated persisted data from crashing the UI.
 */

export const dataQualityStatusSchema = z.enum(['measured', 'estimated', 'unavailable']);

export const freshnessStatusSchema = z.enum(['live', 'recent', 'stale', 'unavailable']);

export const locationSelectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  neighborhood: z.string().optional(),
  region: z.string().optional(),
  country: z.string().min(1),
  countryCode: z.string().min(2),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  source: z.enum(['preset', 'search', 'geolocation']),
});

export const pollutantReadingSchema = z.object({
  code: z.enum(['PM2.5', 'PM10', 'NO2', 'SO2', 'CO', 'O3']),
  label: z.string(),
  value: z.number().nullable(),
  unit: z.enum(['µg/m³', 'mg/m³']),
  status: dataQualityStatusSchema,
  note: z.string().optional(),
});

export const weatherReadingSchema = z.object({
  temperatureC: z.number().nullable(),
  humidityPercent: z.number().nullable(),
  windSpeedKmh: z.number().nullable(),
  status: dataQualityStatusSchema,
  source: z.string(),
  timestamp: z.string().nullable(),
});

export const hourlyAqiPointSchema = z.object({
  time: z.string(),
  aqi: z.number().nullable(),
  pm25: z.number().nullable(),
  pm10: z.number().nullable(),
  status: dataQualityStatusSchema,
});

export const airQualitySnapshotSchema = z.object({
  location: locationSelectionSchema,
  aqi: z.number().nullable(),
  aqiScale: z.enum(['US_EPA', 'INDIA_NAQI']),
  aqiStatus: dataQualityStatusSchema,
  dominantPollutant: z.string().nullable(),
  pollutants: z.array(pollutantReadingSchema),
  weather: weatherReadingSchema,
  hourlyForecast: z.array(hourlyAqiPointSchema),
  trend: z.enum(['improving', 'worsening', 'stable', 'unavailable']),
  trendSummary: z.string(),
  dataSource: z.string(),
  providerId: z.string(),
  stationName: z.string().optional(),
  lastUpdated: z.string().nullable(),
  fetchedAt: z.string(),
  cached: z.boolean(),
  cacheMaxAgeSeconds: z.number(),
  freshness: freshnessStatusSchema,
  notice: z.string().optional(),
});

export const familyChecklistItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  audience: z.enum([
    'household',
    'children',
    'older_adults',
    'sensitive',
    'outdoor_workers',
  ]),
  completed: z.boolean(),
});

export const recordedImpactActionSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'carpool',
    'combine_errands',
    'public_transit',
    'electricity_reduction',
    'avoid_waste_burning',
    'cleaner_cooking',
  ]),
  label: z.string().min(1),
  dateIso: z.string().min(1),
  quantity: z.number(),
  unit: z.string(),
  co2AvoidedKg: z.number().nullable(),
  fuelSavedLiters: z.number().nullable(),
  tripsReduced: z.number(),
  kwhSaved: z.number().nullable(),
  regionGrid: z.enum(['india', 'global', 'us', 'eu']),
  notes: z.string().optional(),
});

export const historicalAqiRecordSchema = z.object({
  id: z.string().min(1),
  recordedAt: z.string().min(1),
  locationId: z.string().min(1),
  locationName: z.string().min(1),
  aqi: z.number().nullable(),
  pm25: z.number().nullable(),
  pm10: z.number().nullable(),
  no2: z.number().nullable(),
  dataSource: z.string(),
  status: dataQualityStatusSchema,
});

export const chatTurnSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  structured: structuredAIResponseSchema.optional(),
  createdAt: z.string(),
  error: z.string().optional(),
});

export const communityChallengeSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  category: z.enum(['transport', 'errands', 'waste', 'energy']),
  description: z.string(),
  goalDescription: z.string(),
  participantsCount: z.number().int().min(0),
  actionsLoggedCount: z.number().int().min(0),
  verifiedNotice: z.string(),
});

export const communityReportItemSchema = z.object({
  id: z.string().min(1),
  areaLabel: z.string(),
  category: z.enum(['tip', 'initiative', 'observation']),
  title: z.string(),
  description: z.string(),
  createdAt: z.string(),
  unverifiedUserReport: z.literal(true),
});

export const communitySummaryResponseSchema = z.object({
  challenges: z.array(communityChallengeSchema),
  reports: z.array(communityReportItemSchema),
  totalVerifiedParticipants: z.number().int().min(0),
  totalLoggedActions: z.number().int().min(0),
});

export const apiPresetsResponseSchema = z.object({
  locations: z.array(locationSelectionSchema),
});

export const apiGeocodeResponseSchema = z.object({
  results: z.array(locationSelectionSchema),
});

export const apiAiResponseSchema = z.object({
  response: structuredAIResponseSchema,
});

export const apiParticipateResponseSchema = z.object({
  challenge: communityChallengeSchema,
  summary: communitySummaryResponseSchema,
});

export const apiReportCreateResponseSchema = z.object({
  report: communityReportItemSchema,
  summary: communitySummaryResponseSchema,
});

export const apiErrorPayloadSchema = z.object({
  error: z.string().optional(),
  code: z.string().optional(),
});

// Re-export entity schemas used for storage parsing
export { householdProfileSchema, indoorConditionsSchema, routineActivitySchema };
