import { z } from 'zod';

/**
 * Runtime validation schemas for external environmental API responses
 * (Open-Meteo Air Quality, Open-Meteo Weather, Open-Meteo Geocoding, WAQI).
 * Untrusted external JSON is always parsed through these schemas before use.
 */

export const openMeteoWeatherResponseSchema = z.object({
  current: z
    .object({
      time: z.string().optional(),
      temperature_2m: z.number().nullable().optional(),
      relative_humidity_2m: z.number().nullable().optional(),
      wind_speed_10m: z.number().nullable().optional(),
    })
    .optional(),
});

export const openMeteoAirQualityResponseSchema = z.object({
  current: z
    .object({
      time: z.string().optional(),
      us_aqi: z.number().nullable().optional(),
      pm2_5: z.number().nullable().optional(),
      pm10: z.number().nullable().optional(),
      nitrogen_dioxide: z.number().nullable().optional(),
      sulphur_dioxide: z.number().nullable().optional(),
      carbon_monoxide: z.number().nullable().optional(),
      ozone: z.number().nullable().optional(),
    })
    .optional(),
  hourly: z
    .object({
      time: z.array(z.string()).optional(),
      us_aqi: z.array(z.number().nullable()).optional(),
      pm2_5: z.array(z.number().nullable()).optional(),
      pm10: z.array(z.number().nullable()).optional(),
    })
    .optional(),
});

export const openMeteoGeocodeResponseSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string(),
        admin1: z.string().optional(),
        admin2: z.string().optional(),
        country: z.string().optional(),
        country_code: z.string().optional(),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }),
    )
    .optional(),
});

export const waqiStationResponseSchema = z.object({
  status: z.string().optional(),
  data: z
    .object({
      aqi: z.union([z.number(), z.string()]).optional(),
      dominentpol: z.string().optional(),
      city: z.object({ name: z.string().optional() }).optional(),
      attributions: z.array(z.object({ name: z.string().optional() })).optional(),
      time: z.object({ iso: z.string().optional() }).optional(),
      iaqi: z.record(z.string(), z.object({ v: z.number().optional() })).optional(),
    })
    .optional(),
});

export const communityDatabaseSchema = z.object({
  challenges: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      category: z.enum(['transport', 'errands', 'waste', 'energy']),
      description: z.string(),
      goalDescription: z.string(),
      participantHashes: z.array(z.string()),
      actionsLoggedCount: z.number().int().min(0),
    }),
  ),
  reports: z.array(
    z.object({
      id: z.string().min(1),
      areaLabel: z.string(),
      category: z.enum(['tip', 'initiative', 'observation']),
      title: z.string(),
      description: z.string(),
      createdAt: z.string(),
      unverifiedUserReport: z.literal(true),
    }),
  ),
});
