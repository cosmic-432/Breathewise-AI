import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, apiClient, parseJsonResponse } from '../api/client.ts';
import { apiPresetsResponseSchema } from '../schemas/storage.ts';
import { CommunityStore } from '../server/communityStore.ts';
import { createRateLimiter } from '../server/rateLimiter.ts';
import { AirQualityService } from '../services/providers/airQualityProvider.ts';
import { formatSafeErrorReason } from '../services/providers/httpClient.ts';
import {
  DEFAULT_CHECKLIST,
  DEFAULT_HOUSEHOLD,
  DEFAULT_INDOOR,
  DEFAULT_LOCATION,
  DEFAULT_ROUTINES,
  STORAGE_KEYS,
  localStore,
} from '../storage/localStore.ts';
import type {
  AirQualitySnapshot,
  ChatTurn,
  FamilyChecklistItem,
  IndoorConditions,
  LocationSelection,
  RecordedImpactAction,
} from '../types/index.ts';
import { createEntityId } from '../utils/id.ts';
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

  it('recovers safely from corrupted, missing, or schema-invalid localStorage entries across all keys', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
    localStore.clearLastStorageError();

    // Missing keys fall back to clean defaults
    expect(localStore.getLocation()).toEqual(DEFAULT_LOCATION);
    expect(localStore.getHousehold()).toEqual(DEFAULT_HOUSEHOLD);
    expect(localStore.getRoutines()).toEqual(DEFAULT_ROUTINES);
    expect(localStore.getIndoor()).toEqual(DEFAULT_INDOOR);
    expect(localStore.getChecklist()).toEqual(DEFAULT_CHECKLIST);
    expect(localStore.getImpactActions()).toEqual([]);
    expect(localStore.getChatHistory()).toEqual([]);
    expect(localStore.getJoinedChallenges()).toEqual([]);

    // Malformed JSON triggers deliberate storage error recording & safe fallback
    storage.setItem(STORAGE_KEYS.location, '{not valid json');
    expect(localStore.getLocation()).toEqual(DEFAULT_LOCATION);
    expect(localStore.getLastStorageError()).toContain('read:');

    // Valid JSON, invalid schema (latitude out of range, missing fields)
    storage.setItem(
      STORAGE_KEYS.location,
      JSON.stringify({ id: 'bad', latitude: 999, longitude: 0 }),
    );
    expect(localStore.getLocation()).toEqual(DEFAULT_LOCATION);
    expect(localStore.getLastStorageError()).toContain('schema:');

    // Invalid household, routines, indoor, checklist, impactActions, chatHistory, joinedChallenges
    storage.setItem(
      STORAGE_KEYS.household,
      JSON.stringify({ memberCount: -5, regionGrid: 'mars' }),
    );
    expect(localStore.getHousehold()).toEqual(DEFAULT_HOUSEHOLD);

    storage.setItem(
      STORAGE_KEYS.routines,
      JSON.stringify([{ id: 'r1', title: 'Bad', durationMinutes: -10 }]),
    );
    expect(localStore.getRoutines()).toEqual(DEFAULT_ROUTINES);

    storage.setItem(
      STORAGE_KEYS.indoor,
      JSON.stringify({ roomSizeSqm: -50, ventilation: 'invalid' }),
    );
    expect(localStore.getIndoor()).toEqual(DEFAULT_INDOOR);

    storage.setItem(
      STORAGE_KEYS.checklist,
      JSON.stringify([{ id: 'c1', text: 123, completed: 'nope' }]),
    );
    expect(localStore.getChecklist()).toEqual(DEFAULT_CHECKLIST);

    storage.setItem(
      STORAGE_KEYS.impactActions,
      JSON.stringify([{ id: 'imp-bad', type: 'unknown' }]),
    );
    expect(localStore.getImpactActions()).toEqual([]);

    storage.setItem(
      STORAGE_KEYS.chatHistory,
      JSON.stringify([{ id: 't1', role: 'system', text: 'bad' }]),
    );
    expect(localStore.getChatHistory()).toEqual([]);

    storage.setItem(STORAGE_KEYS.communityJoined, JSON.stringify([123, null]));
    expect(localStore.getJoinedChallenges()).toEqual([]);

    // Valid write & read roundtrips for every getter/setter
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

    const customIndoor: IndoorConditions = {
      ...DEFAULT_INDOOR,
      roomSizeSqm: 32,
      hasPurifier: true,
      filterType: 'hepa_carbon',
      measuredIndoorPm25: 18,
    };
    localStore.setIndoor(customIndoor);
    expect(localStore.getIndoor()).toEqual(customIndoor);

    const customChecklist: FamilyChecklistItem[] = [
      {
        id: 'chk-custom',
        text: 'Seal bedroom window strip',
        audience: 'children',
        completed: true,
      },
    ];
    localStore.setChecklist(customChecklist);
    expect(localStore.getChecklist()).toEqual(customChecklist);

    const customImpact: RecordedImpactAction[] = [
      {
        id: 'imp-1',
        type: 'carpool',
        label: 'Carpool instead of solo driving',
        dateIso: '2026-11-26T09:00:00.000Z',
        quantity: 3,
        unit: 'days',
        co2AvoidedKg: 4.5,
        fuelSavedLiters: 1.9,
        tripsReduced: 3,
        kwhSaved: null,
        regionGrid: 'india',
      },
    ];
    localStore.setImpactActions(customImpact);
    expect(localStore.getImpactActions()).toEqual(customImpact);

    // Chat history caps at last 24 turns
    const turns: ChatTurn[] = Array.from({ length: 30 }, (_, idx) => ({
      id: `turn-${idx}`,
      role: idx % 2 === 0 ? 'user' : 'assistant',
      text: `Message ${idx}`,
      createdAt: '2026-11-26T09:00:00.000Z',
    }));
    localStore.setChatHistory(turns);
    const savedTurns = localStore.getChatHistory();
    expect(savedTurns).toHaveLength(24);
    expect(savedTurns[0]?.id).toBe('turn-6');

    localStore.setJoinedChallenges(['ch-carpool', 'ch-no-burn']);
    expect(localStore.getJoinedChallenges()).toEqual(['ch-carpool', 'ch-no-burn']);

    // Export includes all user sections cleanly
    const exported: unknown = JSON.parse(localStore.exportAllUserData());
    expect(exported).toMatchObject({
      location: customLoc,
      indoor: customIndoor,
      checklist: customChecklist,
      impactActions: customImpact,
    });

    // Storage write failure (e.g., QuotaExceededError) is handled deliberately without throwing
    const throwingStorage: Storage = {
      ...storage,
      setItem: () => {
        throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
      },
    };
    vi.stubGlobal('window', { localStorage: throwingStorage });
    expect(() => localStore.setLocation(customLoc)).not.toThrow();
    expect(localStore.getLastStorageError()).toContain('QuotaExceededError');

    // Restore working storage for token & clear tests
    vi.stubGlobal('window', { localStorage: storage });
    const token1 = localStore.getOrCreateClientToken();
    const token2 = localStore.getOrCreateClientToken();
    expect(token1.length).toBeGreaterThanOrEqual(12);
    expect(token2).toBe(token1);

    localStore.clearAllUserData();
    expect(localStore.getLocation()).toEqual(DEFAULT_LOCATION);
    expect(localStore.getLastStorageError()).toBeNull();
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

    const afterUnavailable = localStore.recordVerifiedAqiSnapshot({
      ...baseSnapshot,
      aqi: null,
      aqiStatus: 'unavailable',
    });
    expect(afterUnavailable).toHaveLength(0);

    const first = localStore.recordVerifiedAqiSnapshot(baseSnapshot);
    expect(first).toHaveLength(1);
    expect(first[0]?.aqi).toBe(185);
    expect(first[0]?.pm25).toBe(86);

    const second = localStore.recordVerifiedAqiSnapshot(baseSnapshot);
    expect(second).toHaveLength(1);
  });

  it('validates backend JSON responses strictly and rejects malformed or mismatched payloads', async () => {
    const badJsonRes = new Response('<html>502 Bad Gateway</html>', { status: 502 });
    await expect(
      parseJsonResponse(badJsonRes, apiPresetsResponseSchema),
    ).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_JSON',
    });

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

  it('handles schema-invalid external payloads and records redacted provider failures', async () => {
    const recordedFailures: Array<{ providerId: string; reason: string }> = [];
    const service = new AirQualityService({
      waqiToken: 'fake-secret-token-123',
      onProviderError: (providerId, reason) => {
        recordedFailures.push({ providerId, reason });
      },
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
    expect(recordedFailures.map((f) => f.providerId)).toEqual([
      'waqi-station',
      'open-meteo-cams',
    ]);
    expect(formatSafeErrorReason(new Error('Failed for ?token=supersecret123&x=1'))).toBe(
      'Failed for ?token=[redacted]&x=1',
    );
    expect(
      formatSafeErrorReason(new DOMException('The operation was aborted', 'AbortError')),
    ).toBe('request timed out');
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

  it('enforces bounded key eviction and 429 Retry-After headers via real Express middleware', async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 2,
      keyPrefix: 'test-bound',
      maxTrackedKeys: 3,
    });

    const app = express();
    app.set('trust proxy', true);
    app.get('/ping', limiter.middleware, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    expect(
      (await request(app).get('/ping').set('X-Forwarded-For', '10.0.0.1')).status,
    ).toBe(200);
    expect(
      (await request(app).get('/ping').set('X-Forwarded-For', '10.0.0.2')).status,
    ).toBe(200);
    expect(
      (await request(app).get('/ping').set('X-Forwarded-For', '10.0.0.3')).status,
    ).toBe(200);
    expect(limiter.size()).toBe(3);

    // 4th distinct IP triggers bounded eviction keeping size <= maxTrackedKeys
    expect(
      (await request(app).get('/ping').set('X-Forwarded-For', '10.0.0.4')).status,
    ).toBe(200);
    expect(limiter.size()).toBeLessThanOrEqual(3);

    // Repeating same IP beyond maxRequests triggers 429 with Retry-After and JSON error code
    expect(
      (await request(app).get('/ping').set('X-Forwarded-For', '10.0.0.4')).status,
    ).toBe(200);
    const blocked = await request(app).get('/ping').set('X-Forwarded-For', '10.0.0.4');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(blocked.body).toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('tests typeGuards helpers, createEntityId uniqueness, and impactCalculator boundary clamping', () => {
    const allowed = ['a', 'b'] as const;
    expect(isOneOf('a', allowed)).toBe(true);
    expect(isOneOf('c', allowed)).toBe(false);

    expect(getNumericHttpStatus({ status: 413 })).toBe(413);
    expect(getNumericHttpStatus({ status: '413' })).toBeNull();
    expect(getNumericHttpStatus({ status: 4.5 })).toBeNull();
    expect(getNumericHttpStatus(null)).toBeNull();
    expect(getNumericHttpStatus('err')).toBeNull();

    const idA = createEntityId('rt');
    const idB = createEntityId('rt');
    expect(idA.startsWith('rt-')).toBe(true);
    expect(idA).not.toBe(idB);

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

  it('validates apiClient endpoints, optional query params, AbortSignal, null snapshots, and deduplication', async () => {
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
    const requestedUrls: string[] = [];
    const capturedAiBodies: Array<Record<string, unknown>> = [];

    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const url = String(input);
      requestedUrls.push(url);

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
        const parsed: unknown = JSON.parse(String(init?.body ?? '{}'));
        if (typeof parsed === 'object' && parsed !== null) {
          capturedAiBodies.push(parsed as Record<string, unknown>);
        }
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

    // Optional query params (neighborhood, region, refresh=1) are forwarded
    await apiClient.fetchAirQuality(DEFAULT_LOCATION, { refresh: true });
    const refreshUrl = requestedUrls.find((u) => u.includes('refresh=1'));
    expect(refreshUrl).toBeDefined();
    expect(refreshUrl).toContain('neighborhood=');
    expect(refreshUrl).toContain('region=Delhi');

    // Pre-aborted AbortSignal rejects cleanly with AbortError
    const controller = new AbortController();
    controller.abort();
    await expect(
      apiClient.fetchAirQuality(DEFAULT_LOCATION, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    // askAssistant works with both real snapshot and null snapshot
    const aiRes = await apiClient.askAssistant({
      question: 'Should I walk today?',
      snapshot: sampleSnapshot,
    });
    expect(aiRes.summary).toContain('N95');
    expect(capturedAiBodies[0]?.airQuality).not.toBeNull();

    await apiClient.askAssistant({
      question: 'General indoor tips when sensor feed is down?',
      snapshot: null,
    });
    expect(capturedAiBodies[1]?.airQuality).toBeNull();

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
