import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServerApp } from '../../server.ts';
import { AirQualityService } from '../services/providers/airQualityProvider.ts';
import { createGeminiService } from '../services/geminiService.ts';
import { CommunityStore } from '../server/communityStore.ts';
import { generateRoutineRecommendation } from '../utils/routineEngine.ts';
import { evaluateIndoorAir } from '../utils/indoorAdvisor.ts';
import { calculateEnvironmentalImpact } from '../utils/impactCalculator.ts';
import type {
  AirQualitySnapshot,
  HistoricalAqiRecord,
  HouseholdProfile,
  IndoorConditions,
  RoutineActivity,
} from '../types/index.ts';

describe('End-to-End 10-Step User Journey', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'breathewise-e2e-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('completes all 10 core BreatheWise AI journeys seamlessly end-to-end', async () => {
    const mockFetch = (async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('geocoding-api.open-meteo.com')) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: 1,
                name: 'New Delhi',
                admin1: 'Delhi',
                admin2: 'Central Delhi',
                country: 'India',
                country_code: 'IN',
                latitude: 28.6315,
                longitude: 77.2167,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('air-quality-api.open-meteo.com')) {
        return new Response(
          JSON.stringify({
            current: {
              time: new Date().toISOString(),
              us_aqi: 220,
              pm2_5: 135,
              pm10: 215,
              nitrogen_dioxide: 48,
              sulphur_dioxide: 14,
              carbon_monoxide: 1100,
              ozone: 38,
            },
            hourly: {
              time: [
                new Date(Date.now() + 3600000).toISOString(),
                new Date(Date.now() + 7200000).toISOString(),
                new Date(Date.now() + 10800000).toISOString(),
                new Date(Date.now() + 14400000).toISOString(),
              ],
              us_aqi: [220, 210, 175, 200],
              pm2_5: [135, 122, 85, 115],
              pm10: [215, 198, 150, 185],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          current: {
            time: new Date().toISOString(),
            temperature_2m: 19.5,
            relative_humidity_2m: 64,
            wind_speed_10m: 6.2,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const app = createServerApp({
      airQualityService: new AirQualityService({ fetchImpl: mockFetch }),
      geminiService: createGeminiService({
        generateFn: async () =>
          JSON.stringify({
            summary:
              'New Delhi air quality is currently Very Poor (CPCB NAQI 312). Take exposure precautions for your commute and elderly family members indoors.',
            air_quality_context: {
              location: 'New Delhi',
              aqi_value: 312,
              aqi_category: 'Very Poor (CPCB NAQI)',
              data_status: 'Model-estimated',
              data_source: 'Open-Meteo Air Quality (CAMS Atmospheric Model)',
              last_updated: new Date().toISOString(),
            },
            recommendations: [
              {
                title: 'Use enclosed metro for college commute',
                action: 'Avoid open-air cycling or two-wheelers; wear a fitted N95 mask while walking to the station.',
                basis: 'verified_data',
              },
              {
                title: 'Protect elderly members indoors',
                action: 'Keep road-facing windows closed during smog peaks and avoid indoor smoke.',
                basis: 'general_guidance',
              },
            ],
            indoor_actions: ['Close windows during smog peak', 'Use kitchen exhaust during cooking'],
            outdoor_actions: ['Limit non-essential outdoor trips'],
            sustainable_alternatives: ['Use enclosed metro transit instead of solo car'],
            impact_explanation: ['Enclosed transit reduces tailpipe emissions without exposing you to roadside smoke.'],
            limitations: ['Educational guidance only; seek medical assistance if breathing symptoms appear.'],
            sources: ['Open-Meteo Air Quality (CAMS Atmospheric Model)'],
          }),
      }),
      communityStore: new CommunityStore(tmpDir),
    });

    // 1. User opens app and selects a location
    const geoRes = await request(app).get('/api/geocode').query({ q: 'New Delhi' });
    expect(geoRes.status).toBe(200);
    const chosenLocation = geoRes.body.results[0];
    expect(chosenLocation.name).toBe('New Delhi');

    // 2. App retrieves air-quality data
    const aqRes = await request(app).get('/api/air-quality').query({
      lat: chosenLocation.latitude,
      lon: chosenLocation.longitude,
      name: chosenLocation.name,
      country: chosenLocation.country,
      countryCode: chosenLocation.countryCode,
    });
    expect(aqRes.status).toBe(200);
    const snapshot = aqRes.body as AirQualitySnapshot;
    expect(snapshot.aqi).toBeGreaterThan(300);
    expect(snapshot.dataSource).toContain('Open-Meteo');

    // 3. User saves household preferences
    const household: HouseholdProfile = {
      memberCount: 4,
      ageGroups: ['adults', 'older_adults_65_plus'],
      outdoorActivities: ['College commute', 'Evening walk'],
      commutePatterns: ['Metro'],
      ventilationSetup: 'natural_windows',
      sensitivities: ['school_commuter'],
      preferredUnitSystem: 'metric',
      regionGrid: 'india',
    };

    // 4. User asks Gemini for personalized guidance
    const aiRes = await request(app).post('/api/ai/assist').send({
      question:
        'The AQI in my area is very poor. I need to commute to college and my family has elderly members at home. What should we do today?',
      mode: 'assistant',
      airQuality: {
        locationName: snapshot.location.name,
        country: snapshot.location.country,
        aqi: snapshot.aqi,
        aqiScale: snapshot.aqiScale,
        aqiStatus: snapshot.aqiStatus,
        dominantPollutant: snapshot.dominantPollutant,
        pollutants: snapshot.pollutants.map((p) => ({
          code: p.code,
          value: p.value,
          unit: p.unit,
          status: p.status,
        })),
        trendSummary: snapshot.trendSummary,
        dataSource: snapshot.dataSource,
        lastUpdated: snapshot.lastUpdated,
        freshness: snapshot.freshness,
      },
      household,
    });
    expect(aiRes.status).toBe(200);
    expect(aiRes.body.response.recommendations.length).toBeGreaterThanOrEqual(2);

    // 5. User creates a daily routine and receives safety-first recommendations
    const commuteRoutine: RoutineActivity = {
      id: 'rt-1',
      title: 'College Commute',
      category: 'school_college_commute',
      preferredBlock: 'morning',
      durationMinutes: 45,
      isOutdoor: true,
      currentTransport: 'public_transit',
    };
    const routineRec = generateRoutineRecommendation(
      commuteRoutine,
      snapshot,
      household,
    );
    expect(routineRec.exposureLevel).toBe('high');
    expect(routineRec.healthOverEmissionsNote).toContain('skip cycling');

    // 6. User enters indoor conditions and receives indoor air recommendations
    const indoor: IndoorConditions = {
      roomSizeSqm: 28,
      occupants: 4,
      ventilation: 'natural_windows',
      nearbySources: ['Busy main road nearby'],
      hasPurifier: false,
      filterType: 'none',
      cookingFuel: 'lpg_piped_gas',
      usesIncenseOrCandles: false,
      indoorSmoking: false,
      measuredIndoorPm25: null,
    };
    const indoorAdvice = evaluateIndoorAir(indoor, snapshot);
    expect(indoorAdvice.measuredSection.hasSensorData).toBe(false);
    expect(indoorAdvice.ventilationStrategy).toContain('NOT beneficial');
    expect(indoorAdvice.recommendedCadrM3h).toBeGreaterThan(300);

    // 7 & 8. User records a sustainable action and impact calculator updates deterministically
    const impact = calculateEnvironmentalImpact({
      type: 'public_transit',
      distanceKm: 18,
      daysPerWeek: 5,
      regionGrid: 'india',
    });
    expect(impact.quantifiable).toBe(true);
    expect(impact.co2AvoidedKg).toBe(9.27);
    expect(impact.fuelSavedLiters).toBe(6.75);

    // 9. User joins a community challenge and logs action
    const joinRes = await request(app).post('/api/community/participate').send({
      challengeId: 'ch-reduce-solo-trips',
      action: 'log_action',
      clientToken: 'e2e-family-token-99',
    });
    expect(joinRes.status).toBe(200);
    expect(joinRes.body.challenge.participantsCount).toBe(1);
    expect(joinRes.body.challenge.actionsLoggedCount).toBe(1);

    // 10. User revisits verified history (distinct from user-generated actions)
    const historyRecord: HistoricalAqiRecord = {
      id: 'h-1',
      recordedAt: snapshot.lastUpdated ?? snapshot.fetchedAt,
      locationId: snapshot.location.id,
      locationName: snapshot.location.name,
      aqi: snapshot.aqi,
      pm25: snapshot.pollutants.find((p) => p.code === 'PM2.5')?.value ?? null,
      pm10: snapshot.pollutants.find((p) => p.code === 'PM10')?.value ?? null,
      no2: snapshot.pollutants.find((p) => p.code === 'NO2')?.value ?? null,
      dataSource: snapshot.dataSource,
      status: snapshot.aqiStatus,
    };
    expect(historyRecord.aqi).toBe(snapshot.aqi);
    expect(historyRecord.status).toBe('estimated');
  });
});
