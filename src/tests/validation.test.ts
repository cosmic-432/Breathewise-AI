import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, apiClient, parseJsonResponse } from '../api/client.ts';
import { apiPresetsResponseSchema } from '../schemas/storage.ts';
import { CommunityStore } from '../server/communityStore.ts';
import { createRateLimiter } from '../server/rateLimiter.ts';
import { AirQualityService } from '../services/providers/airQualityProvider.ts';
import {
  DEFAULT_HOUSEHOLD,
  DEFAULT_LOCATION,
  DEFAULT_ROUTINES,
  STORAGE_KEYS,
  localStore,
} from '../storage/localStore.ts';
import type { AirQualitySnapshot, LocationSelection } from '../types/index.ts';
import { calculateEnvironmentalImpact } from '../utils/impactCalculator.ts';
import { getNumericHttpStatus, isOneOf } from '../utils/typeGuards.ts';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length(): number {
      return store.size;
    },
    clear: (): void => {
      store.clear();
    },
    getItem: (key: string): string | null => store.get(key) ?? null,
    key: (index: number): string | null => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string): void => {
      store.delete(key);
    },
    setItem: (key: string, value: string): void => {
      store.set(key, value);
    },
  };
}

describe('Runtime validation across localStorage, API responses, and external providers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('recovers safely from corrupted or schema-invalid localStorage entries', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });

    // Malformed JSON
    storage.setItem(STORAGE_KEYS.location, '{not valid json');
    expect(localStore.getLocation()).toEqual(DEFAULT_LOCATION);

    // Valid JSON, invalid schema (latitude out of range, missing fields)
    storage.setItem(
      STORAGE_KEYS.location,
      JSON.stringify({ id: 'bad', latitude: 999, longitude: 0 }),
    );
    expect(localStore.getLocation()).toEqual(DEFAULT_LOCATION);

    // Invalid household profile (negative memberCount, invalid grid)
    storage.setItem(
      STORAGE_KEYS.household,
      JSON.stringify({ memberCount: -5, regionGrid: 'mars' }),
    );
    expect(localStore.getHousehold()).toEqual(DEFAULT_HOUSEHOLD);

    // Invalid routines array
    storage.setItem(
      STORAGE_KEYS.routines,
      JSON.stringify([{ id: 'r1', title: 'Bad', durationMinutes: -10 }]),
    );
    expect(localStore.getRoutines()).toEqual(DEFAULT_ROUTINES);

    // Valid write & read roundtrip
    const customLoc: LocationSelection = {
      id: 'in-pune',
      name: 'Pune',
      country: 'India',
      countryCode: 'IN',
      latitude: 18.52,
      longitude: 73.85,
      source: 'search',
    };
    localStore.setLocation(customLoc);
    expect(localStore.getLocation()).toEqual(customLoc);

    // Client token generation & persistence
    const token1 = localStore.getOrCreateClientToken();
    const token2 = localStore.getOrCreateClientToken();
    expect(token1.length).toBeGreaterThanOrEqual(12);
    expect(token2).toBe(token1);

    // Clear all local data resets everything cleanly
    localStore.clearAllUserData();
    expect(localStore.getLocation()).toEqual(DEFAULT_LOCATION);
  });

  it('records only verified AQI snapshots and deduplicates within 15 minutes', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });

    const baseSnapshot: AirQualitySnapshot = {
      location: DEFAULT_LOCATION,
      aqi: 185,
      aqiScale: 'INDIA_NAQI',
      aqiStatus: 'estimated',
      dominantPollutant: 'PM2.5',
      pollutants: [
        {
          code: 'PM2.5',
          label: 'Fine Particulate Matter',
          value: 86,
          unit: 'µg/m³',
          status: 'estimated',
        },
      ],
      weather: {
        temperatureC: 24,
        humidityPercent: 55,
        windSpeedKmh: 8,
        status: 'estimated',
        source: 'Open-Meteo',
        timestamp: new Date().toISOString(),
      },
      hourlyForecast: [],
      trend: 'stable',
      trendSummary: 'Stable conditions.',
      dataSource: 'Open-Meteo CAMS',
      providerId: 'open-meteo-cams',
      lastUpdated: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      cached: false,
      cacheMaxAgeSeconds: 600,
      freshness: 'live',
    };

    // Unavailable snapshots must never be persisted into history
    const afterUnavailable = localStore.recordVerifiedAqiSnapshot({
      ...baseSnapshot,
      aqi: null,
      aqiStatus: 'unavailable',
    });
    expect(afterUnavailable).toHaveLength(0);

    // First valid snapshot is stored
    const first = localStore.recordVerifiedAqiSnapshot(baseSnapshot);
    expect(first).toHaveLength(1);
    expect(first[0]?.aqi).toBe(185);
    expect(first[0]?.pm25).toBe(86);

    // Immediate duplicate for same location within 15 minutes is deduplicated
    const second = localStore.recordVerifiedAqiSnapshot(baseSnapshot);
    expect(second).toHaveLength(1);
  });

  it('validates backend JSON responses strictly and rejects malformed or mismatched payloads', async () => {
    // Non-JSON payload
    const badJsonRes = new Response('<html>502 Bad Gateway</html>', { status: 502 });
    await expect(
      parseJsonResponse(badJsonRes, apiPresetsResponseSchema),
    ).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_JSON',
    });

    // Structured API error response
    const errRes = new Response(
      JSON.stringify({ error: 'Rate limit exceeded', code: 'RATE_LIMITED' }),
      { status: 429 },
    );
    await expect(
      parseJsonResponse(errRes, apiPresetsResponseSchema),
    ).rejects.toMatchObject({
      message: 'Rate limit exceeded',
      status: 429,
      code: 'RATE_LIMITED',
    });

    // 200 OK with wrong schema
    const mismatchRes = new Response(
      JSON.stringify({ locations: [{ id: 123, broken: true }] }),
      { status: 200 },
    );
    await expect(
      parseJsonResponse(mismatchRes, apiPresetsResponseSchema),
    ).rejects.toBeInstanceOf(ApiClientError);
    await expect(
      parseJsonResponse(
        new Response(JSON.stringify({ locations: 'not-an-array' }), { status: 200 }),
        apiPresetsResponseSchema,
      ),
    ).rejects.toMatchObject({
      status: 502,
      code: 'RESPONSE_SCHEMA_MISMATCH',
    });
  });

  it('handles schema-invalid external air-quality and geocoding provider payloads gracefully', async () => {
    const service = new AirQualityService({
      waqiToken: 'fake-token-for-test',
      fetchImpl: async (url) => {
        const href = String(url);
        if (href.includes('geocoding-api.open-meteo.com')) {
          return new Response(
            JSON.stringify({ results: [{ id: 'not-a-number', name: 42 }] }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ status: 'ok', data: 'corrupted' }), {
          status: 200,
        });
      },
    });

    await expect(service.searchLocations('Delhi')).rejects.toThrow(/invalid payload/i);

    const snapshot = await service.getSnapshot(DEFAULT_LOCATION, true);
    expect(snapshot.aqi).toBeNull();
    expect(snapshot.aqiStatus).toBe('unavailable');
    expect(snapshot.weather.status).toBe('unavailable');
    expect(snapshot.pollutants.every((p) => p.status === 'unavailable')).toBe(true);
  });

  it('recovers gracefully when persisted community.json on disk is corrupted', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'breathewise-corrupt-'));
    const dbPath = path.join(tmpDir, 'community.json');
    fs.writeFileSync(dbPath, '{ corrupted json !!!', 'utf-8');

    const store = new CommunityStore(dbPath);
    const summary = store.getSummary();
    expect(summary.challenges.length).toBeGreaterThanOrEqual(4);
    expect(summary.totalVerifiedParticipants).toBe(0);
    expect(summary.reports).toEqual([]);

    // Also test valid JSON with wrong schema
    fs.writeFileSync(
      dbPath,
      JSON.stringify({ challenges: 'invalid', reports: 123 }),
      'utf-8',
    );
    const store2 = new CommunityStore(dbPath);
    expect(store2.getSummary().challenges.length).toBeGreaterThanOrEqual(4);
    expect(store2.getSummary().reports).toEqual([]);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('enforces bounded key eviction in rateLimiter so high-cardinality IPs cannot exhaust memory', () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 2,
      keyPrefix: 'test-bound',
      maxTrackedKeys: 3,
    });

    const invoke = (ip: string): number => {
      let status = 200;
      const req = { ip, socket: { remoteAddress: ip } } as unknown as Request;
      const res = {
        setHeader: vi.fn(),
        status: (code: number) => {
          status = code;
          return { json: vi.fn() };
        },
      } as unknown as Response;
      limiter.middleware(req, res, vi.fn());
      return status;
    };

    expect(invoke('10.0.0.1')).toBe(200);
    expect(invoke('10.0.0.2')).toBe(200);
    expect(invoke('10.0.0.3')).toBe(200);
    expect(limiter.size()).toBe(3);

    // 4th distinct IP triggers bounded eviction keeping size <= maxTrackedKeys
    expect(invoke('10.0.0.4')).toBe(200);
    expect(limiter.size()).toBeLessThanOrEqual(3);

    // Repeating same IP beyond maxRequests triggers 429
    expect(invoke('10.0.0.4')).toBe(200);
    expect(invoke('10.0.0.4')).toBe(429);
  });

  it('tests typeGuards helpers and impactCalculator boundary clamping', () => {
    const allowed = ['a', 'b'] as const;
    expect(isOneOf('a', allowed)).toBe(true);
    expect(isOneOf('c', allowed)).toBe(false);

    expect(getNumericHttpStatus({ status: 413 })).toBe(413);
    expect(getNumericHttpStatus({ status: '413' })).toBeNull();
    expect(getNumericHttpStatus({ status: 4.5 })).toBeNull();
    expect(getNumericHttpStatus(null)).toBeNull();
    expect(getNumericHttpStatus('err')).toBeNull();

    // Clamping boundaries on impactCalculator
    const clampedCarpool = calculateEnvironmentalImpact({
      type: 'carpool',
      distanceKm: -10,
      passengersShared: 99,
      daysPerWeek: 99,
    });
    expect(clampedCarpool.quantifiable).toBe(true);
    expect(clampedCarpool.co2AvoidedKg).toBeGreaterThan(0);

    const usGrid = calculateEnvironmentalImpact({
      type: 'electricity_reduction',
      kwhSaved: 0,
      regionGrid: 'us',
    });
    expect(usGrid.kwhSaved).toBe(1);
    expect(usGrid.co2AvoidedKg).toBe(0.37);

    const globalGrid = calculateEnvironmentalImpact({
      type: 'electricity_reduction',
      kwhSaved: 10,
      regionGrid: 'global',
    });
    expect(globalGrid.co2AvoidedKg).toBe(4.36);
  });

  it('validates all apiClient endpoint payloads and deduplicates concurrent fetchAirQuality calls', async () => {
    const sampleSnapshot: AirQualitySnapshot = {
      location: DEFAULT_LOCATION,
      aqi: 142,
      aqiScale: 'INDIA_NAQI',
      aqiStatus: 'estimated',
      dominantPollutant: 'PM2.5',
      pollutants: [
        {
          code: 'PM2.5',
          label: 'Fine Particulate Matter',
          value: 72,
          unit: 'µg/m³',
          status: 'estimated',
        },
      ],
      weather: {
        temperatureC: 25,
        humidityPercent: 50,
        windSpeedKmh: 9,
        status: 'estimated',
        source: 'Open-Meteo',
        timestamp: '2026-11-26T10:00:00Z',
      },
      hourlyForecast: [],
      trend: 'stable',
      trendSummary: 'Stable.',
      dataSource: 'Open-Meteo CAMS',
      providerId: 'open-meteo-cams',
      lastUpdated: '2026-11-26T10:00:00Z',
      fetchedAt: '2026-11-26T10:05:00Z',
      cached: false,
      cacheMaxAgeSeconds: 600,
      freshness: 'live',
    };

    const sampleCommunitySummary = {
      challenges: [
        {
          id: 'ch-1',
          title: 'Carpool Week',
          category: 'transport' as const,
          description: 'Share rides safely.',
          goalDescription: '2 shared commutes',
          participantsCount: 1,
          actionsLoggedCount: 1,
          verifiedNotice: 'Verified locally.',
        },
      ],
      reports: [
        {
          id: 'rep-1',
          areaLabel: 'South Delhi',
          category: 'tip' as const,
          title: 'Compost dry leaves',
          description: 'Use neighborhood leaf composting bins instead of burning.',
          createdAt: '2026-11-26T10:00:00Z',
          unverifiedUserReport: true as const,
        },
      ],
      totalVerifiedParticipants: 1,
      totalLoggedActions: 1,
    };

    let airQualityFetchCount = 0;
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/locations/presets')) {
        return new Response(JSON.stringify({ locations: [DEFAULT_LOCATION] }), {
          status: 200,
        });
      }
      if (url.startsWith('/api/geocode')) {
        return new Response(JSON.stringify({ results: [DEFAULT_LOCATION] }), {
          status: 200,
        });
      }
      if (url.startsWith('/api/air-quality')) {
        airQualityFetchCount += 1;
        await new Promise((r) => setTimeout(r, 15));
        return new Response(JSON.stringify(sampleSnapshot), { status: 200 });
      }
      if (url.startsWith('/api/ai/assist')) {
        return new Response(
          JSON.stringify({
            response: {
              summary: 'Use N95 during peak hours.',
              air_quality_context: {
                location: 'New Delhi',
                aqi_value: 142,
                aqi_category: 'Moderate',
                data_status: 'Estimated',
                data_source: 'Open-Meteo CAMS',
                last_updated: '2026-11-26T10:00:00Z',
              },
              recommendations: [
                {
                  title: 'Time errands',
                  action: 'Prefer midday.',
                  basis: 'verified_data',
                },
              ],
              indoor_actions: ['Close roadside windows'],
              outdoor_actions: ['Avoid busy intersections'],
              sustainable_alternatives: ['Take metro'],
              impact_explanation: ['Reduces personal tailpipe exposure'],
              limitations: ['Not medical advice'],
              sources: ['Open-Meteo CAMS'],
            },
          }),
          { status: 200 },
        );
      }
      if (url === '/api/community') {
        return new Response(JSON.stringify(sampleCommunitySummary), { status: 200 });
      }
      if (url === '/api/community/participate') {
        return new Response(
          JSON.stringify({
            challenge: sampleCommunitySummary.challenges[0],
            summary: sampleCommunitySummary,
          }),
          { status: 200 },
        );
      }
      if (url === '/api/community/reports') {
        return new Response(
          JSON.stringify({
            report: sampleCommunitySummary.reports[0],
            summary: sampleCommunitySummary,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    });

    vi.stubGlobal('fetch', mockFetch);

    expect(await apiClient.fetchPresets()).toEqual([DEFAULT_LOCATION]);
    expect(await apiClient.searchLocations('Delhi')).toEqual([DEFAULT_LOCATION]);

    // Concurrent calls without AbortSignal should deduplicate into 1 network fetch
    const [snapA, snapB] = await Promise.all([
      apiClient.fetchAirQuality(DEFAULT_LOCATION),
      apiClient.fetchAirQuality(DEFAULT_LOCATION),
    ]);
    expect(airQualityFetchCount).toBe(1);
    expect(snapA.aqi).toBe(142);
    expect(snapB.aqi).toBe(142);

    const aiRes = await apiClient.askAssistant({
      question: 'Should I walk today?',
      snapshot: sampleSnapshot,
    });
    expect(aiRes.summary).toContain('N95');

    const comm = await apiClient.fetchCommunity();
    expect(comm.totalVerifiedParticipants).toBe(1);

    const participated = await apiClient.participateInChallenge({
      challengeId: 'ch-1',
      action: 'join',
      clientToken: 'abcdef123456',
    });
    expect(participated.challenge.id).toBe('ch-1');

    const posted = await apiClient.submitCommunityReport({
      areaLabel: 'South Delhi',
      category: 'tip',
      title: 'Compost dry leaves',
      description: 'Use neighborhood leaf composting bins instead of burning.',
    });
    expect(posted.report.id).toBe('rep-1');
  });
});
