import { z } from 'zod';

/**
 * Strips control characters and common prompt-injection framing patterns
 * before forwarding untrusted user strings to Gemini.
 */
function stripControlChars(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const isDisallowedControl =
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f;
    if (!isDisallowedControl) {
      result += value[i];
    }
  }
  return result;
}

export function sanitizeUserText(input: string): string {
  return stripControlChars(input)
    .replace(/<\/?(system|assistant|developer|instructions?)>/gi, '')
    .trim();
}

export const coordinatesQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  name: z.string().trim().min(1).max(120).optional(),
  neighborhood: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
  country: z.string().trim().min(1).max(100).optional(),
  countryCode: z.string().trim().min(2).max(4).optional(),
  source: z.enum(['preset', 'search', 'geolocation']).optional(),
});

export const geocodeQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, 'Enter at least 2 characters to search a city or neighborhood.')
    .max(80, 'Search query is too long.'),
});

export const householdProfileSchema = z.object({
  memberCount: z.number().int().min(1).max(20),
  ageGroups: z.array(
    z.enum(['children_under_12', 'teens', 'adults', 'older_adults_65_plus']),
  ),
  outdoorActivities: z.array(z.string().max(80)).max(12),
  commutePatterns: z.array(z.string().max(80)).max(12),
  ventilationSetup: z.enum([
    'closed_ac',
    'natural_windows',
    'mixed',
    'purifier_assisted',
  ]),
  sensitivities: z.array(
    z.enum([
      'respiratory_sensitivity',
      'cardiovascular_sensitivity',
      'pregnancy',
      'outdoor_worker',
      'school_commuter',
    ]),
  ),
  preferredUnitSystem: z.enum(['metric', 'imperial']).default('metric'),
  regionGrid: z.enum(['india', 'global', 'us', 'eu']).default('india'),
});

export const routineActivitySchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(2, 'Activity title is required.').max(100),
  category: z.enum([
    'school_college_commute',
    'office_commute',
    'shopping',
    'exercise',
    'outdoor_work',
    'walking',
    'family_activities',
    'other',
  ]),
  preferredBlock: z.enum(['morning', 'afternoon', 'evening', 'night']),
  durationMinutes: z.number().int().min(5).max(720),
  isOutdoor: z.boolean(),
  currentTransport: z
    .enum(['car_solo', 'carpool', 'two_wheeler', 'public_transit', 'walk_cycle', 'none'])
    .optional(),
  notes: z.string().trim().max(240).optional(),
});

export const indoorConditionsSchema = z.object({
  roomSizeSqm: z.number().min(4).max(500),
  occupants: z.number().int().min(1).max(30),
  ventilation: z.enum(['closed', 'natural_windows', 'exhaust_fans', 'mechanical_hvac']),
  nearbySources: z.array(z.string().max(80)).max(10),
  hasPurifier: z.boolean(),
  filterType: z.enum([
    'none',
    'true_hepa',
    'hepa_carbon',
    'basic_dust',
    'ionizer_ozone',
    'unknown',
  ]),
  indoorHumidityPercent: z.number().min(5).max(100).nullable().optional(),
  cookingFuel: z.enum([
    'electric_induction',
    'lpg_piped_gas',
    'solid_biomass_coal',
    'mixed',
  ]),
  usesIncenseOrCandles: z.boolean(),
  indoorSmoking: z.boolean(),
  measuredIndoorPm25: z.number().min(0).max(2000).nullable().optional(),
  sensorLabel: z.string().trim().max(80).optional(),
});

export const aiAssistantRequestSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, 'Please enter a question or scenario.')
    .max(1200, 'Question exceeds 1200 characters.'),
  mode: z
    .enum([
      'assistant',
      'routine',
      'indoor',
      'sustainable',
      'family',
      'community',
      'explain',
    ])
    .default('assistant'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().max(1500),
      }),
    )
    .max(8)
    .optional(),
  airQuality: z
    .object({
      locationName: z.string().max(140),
      country: z.string().max(100),
      aqi: z.number().nullable(),
      aqiScale: z.enum(['US_EPA', 'INDIA_NAQI']),
      aqiStatus: z.enum(['measured', 'estimated', 'unavailable']),
      dominantPollutant: z.string().nullable(),
      pollutants: z.array(
        z.object({
          code: z.string(),
          value: z.number().nullable(),
          unit: z.string(),
          status: z.enum(['measured', 'estimated', 'unavailable']),
        }),
      ),
      temperatureC: z.number().nullable().optional(),
      humidityPercent: z.number().nullable().optional(),
      windSpeedKmh: z.number().nullable().optional(),
      trendSummary: z.string().max(240),
      dataSource: z.string().max(160),
      lastUpdated: z.string().nullable(),
      freshness: z.enum(['live', 'recent', 'stale', 'unavailable']),
    })
    .nullable()
    .optional(),
  household: householdProfileSchema.optional(),
  indoor: indoorConditionsSchema.optional(),
  routines: z.array(routineActivitySchema).max(20).optional(),
});

export const structuredAIResponseSchema = z.object({
  summary: z.string().min(1),
  air_quality_context: z.object({
    location: z.string(),
    aqi_value: z.number().nullable(),
    aqi_category: z.string(),
    data_status: z.string(),
    data_source: z.string(),
    last_updated: z.string(),
  }),
  recommendations: z.array(
    z.object({
      title: z.string(),
      action: z.string(),
      basis: z.enum(['verified_data', 'general_guidance']),
    }),
  ),
  indoor_actions: z.array(z.string()),
  outdoor_actions: z.array(z.string()),
  sustainable_alternatives: z.array(z.string()),
  impact_explanation: z.array(z.string()),
  limitations: z.array(z.string()),
  sources: z.array(z.string()),
});

export const communityJoinSchema = z.object({
  challengeId: z.string().trim().min(1).max(64),
  action: z.enum(['join', 'log_action']),
  clientToken: z.string().trim().min(8).max(80),
});

/**
 * Detects likely emails, phone numbers, or explicit street/apartment addresses
 * so users cannot accidentally expose personal household details in public community posts.
 */
export function containsPotentialPii(text: string): boolean {
  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phonePattern = /(?:\+?\d[\d\s().-]{8,}\d)\b/;
  const hasPhoneLikeDigits = (value: string): boolean => {
    const matches = value.match(new RegExp(phonePattern, 'g')) ?? [];
    return matches.some((m) => m.replace(/\D/g, '').length >= 10);
  };
  const streetPattern =
    /\b(?:house\s*(?:no\.?|#)|flat\s*(?:no\.?|#)|apt\.?\s*#?\d+|door\s*no\.?|\d{1,5}\s+[A-Za-z]+\s+(?:street|st\.?|road|rd\.?|lane|ln\.?|avenue|ave\.?|boulevard|blvd\.?))\b/i;
  return emailPattern.test(text) || hasPhoneLikeDigits(text) || streetPattern.test(text);
}

export const communityReportSchema = z
  .object({
    areaLabel: z
      .string()
      .trim()
      .min(2, 'Please provide a general city or district name (no street address).')
      .max(60),
    category: z.enum(['tip', 'initiative', 'observation']),
    title: z.string().trim().min(4, 'Title must be at least 4 characters.').max(100),
    description: z
      .string()
      .trim()
      .min(10, 'Description must be at least 10 characters.')
      .max(500),
  })
  .superRefine((data, ctx) => {
    const combined = `${data.areaLabel} ${data.title} ${data.description}`;
    if (containsPotentialPii(combined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'For your privacy, please remove street addresses, house/flat numbers, phone numbers, or email addresses before posting publicly.',
      });
    }
  });

export const impactInputSchema = z.object({
  type: z.enum([
    'carpool',
    'combine_errands',
    'public_transit',
    'electricity_reduction',
    'avoid_waste_burning',
    'cleaner_cooking',
  ]),
  distanceKm: z.number().min(0.5).max(1000).optional(),
  passengersShared: z.number().int().min(2).max(6).optional(),
  tripsConsolidated: z.number().int().min(1).max(30).optional(),
  kwhSaved: z.number().min(1).max(5000).optional(),
  daysPerWeek: z.number().int().min(1).max(7).optional(),
  regionGrid: z.enum(['india', 'global', 'us', 'eu']).default('india'),
});
