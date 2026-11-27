import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServerApp } from '../../server.ts';
import { AirQualityService } from '../services/providers/airQualityProvider.ts';
import { createGeminiService } from '../services/geminiService.ts';
import { CommunityStore } from '../server/communityStore.ts';

function createMockFetch(options: {
  aqStatus?: number;
  weatherStatus?: number;
  aqBody?: unknown;
  weatherBody?: unknown;
}): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('air-quality-api.open-meteo.com')) {
      const status = options.aqStatus ?? 200;
      return new Response(JSON.stringify(options.aqBody ?? {}), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('api.open-meteo.com/v1/forecast')) {
      const status = options.weatherStatus ?? 200;
      return new Response(JSON.stringify(options.weatherBody ?? {}), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('geocoding-api.open-meteo.com')) {
      return new Response(
        JSON.stringify({
          results: [
            {
              id: 1273294,
              name: 'Delhi',
              admin1: 'Delhi',
              country: 'India',
              country_code: 'IN',
              latitude: 28.6519,
              longitude: 77.2315,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
}

const VALID_AI_JSON = JSON.stringify({
  summary: 'Air quality in New Delhi is currently Poor based on retrieved data.',
  air_quality_context: {
    location: 'New Delhi',
    aqi_value: 251,
    aqi_category: 'Poor (CPCB NAQI)',
    data_status: 'Model-estimated',
    data_source: 'Open-Meteo Air Quality (CAMS Atmospheric Model)',
    last_updated: '2026-11-26T12:00:00Z',
  },
  recommendations: [
    {
      title: 'Use enclosed transit for college commute',
      action: 'Prefer enclosed metro or carpool over open two-wheelers.',
      basis: 'verified_data',
    },
  ],
  indoor_actions: ['Keep road-facing windows closed during smog peaks.'],
  outdoor_actions: ['Wear a well-fitted N95 respirator when walking outdoors.'],
  sustainable_alternatives: ['Take metro instead of solo driving.'],
  impact_explanation: ['Reduces both personal exposure and tailpipe exhaust.'],
  limitations: ['General educational guidance only; seek medical care for symptoms.'],
  sources: ['Open-Meteo Air Quality (CAMS Atmospheric Model)'],
});

describe('API integration, error handling, rate limiting, and security', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'breathewise-int-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('retrieves air quality, handles individual missing pollutants, and handles weather provider failure cleanly', async () => {
    const aqService = new AirQualityService({
      fetchImpl: createMockFetch({
        aqBody: {
          current: {
            time: new Date().toISOString(),
            us_aqi: 185,
            pm2_5: 105,
            pm10: 190,
            nitrogen_dioxide: null, // missing pollutant must be unavailable individually
            sulphur_dioxide: 12.4,
            carbon_monoxide: 950,
            ozone: 42,
          },
          hourly: {
            time: [
              new Date(Date.now() + 3600000).toISOString(),
              new Date(Date.now() + 7200000).toISOString(),
            ],
            us_aqi: [180, 165],
            pm2_5: [100, 88],
            pm10: [180, 160],
          },
        },
        weatherStatus: 503, // Simulate weather provider failure
      }),
    });

    const app = createServerApp({
      airQualityService: aqService,
      communityStore: new CommunityStore(tmpDir),
    });

    const res = await request(app).get('/api/air-quality').query({
      lat: 28.6315,
      lon: 77.2167,
      name: 'New Delhi',
      country: 'India',
      countryCode: 'IN',
    });

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.body.aqiScale).toBe('INDIA_NAQI');
    expect(res.body.aqi).toBe(251);
    expect(res.body.weather.status).toBe('unavailable');
    const no2 = res.body.pollutants.find((p: { code: string }) => p.code === 'NO2');
    expect(no2.status).toBe('unavailable');
    expect(no2.value).toBeNull();
  });

  it('returns explicit unavailable state without substituting another city when air-quality provider fails', async () => {
    const aqService = new AirQualityService({
      fetchImpl: createMockFetch({ aqStatus: 500, weatherStatus: 500 }),
    });
    const app = createServerApp({
      airQualityService: aqService,
      communityStore: new CommunityStore(tmpDir),
    });

    const res = await request(app).get('/api/air-quality').query({
      lat: 19.07,
      lon: 72.87,
      name: 'Mumbai',
      country: 'India',
      countryCode: 'IN',
    });

    expect(res.status).toBe(200);
    expect(res.body.aqi).toBeNull();
    expect(res.body.aqiStatus).toBe('unavailable');
    expect(res.body.notice).toContain('will not substitute');
  });

  it('rejects missing location parameters and malformed JSON payloads', async () => {
    const app = createServerApp({
      communityStore: new CommunityStore(tmpDir),
    });

    const badLoc = await request(app).get('/api/air-quality');
    expect(badLoc.status).toBe(400);

    const badJson = await request(app)
      .post('/api/ai/assist')
      .set('Content-Type', 'application/json')
      .send('{broken json');
    expect(badJson.status).toBe(400);
    expect(badJson.body.code).toBe('MALFORMED_JSON');
  });

  it('handles Gemini timeout and invalid Gemini response safely', async () => {
    const timeoutApp = createServerApp({
      geminiService: createGeminiService({
        timeoutMs: 40,
        generateFn: () =>
          new Promise((resolve) => setTimeout(() => resolve(VALID_AI_JSON), 250)),
      }),
      communityStore: new CommunityStore(tmpDir),
    });

    const timeoutRes = await request(timeoutApp)
      .post('/api/ai/assist')
      .send({ question: 'What should my family do today?' });
    expect(timeoutRes.status).toBe(504);
    expect(timeoutRes.body.code).toBe('AI_TIMEOUT');

    const invalidApp = createServerApp({
      geminiService: createGeminiService({
        generateFn: async () => 'Sorry, plain unstructured text instead of schema',
      }),
      communityStore: new CommunityStore(tmpDir),
    });

    const invalidRes = await request(invalidApp)
      .post('/api/ai/assist')
      .send({ question: 'What should my family do today?' });
    expect(invalidRes.status).toBe(502);
    expect(invalidRes.body.code).toBe('INVALID_AI_JSON');
  });

  it('enforces AI endpoint rate limiting with HTTP 429 and Retry-After', async () => {
    const app = createServerApp({
      aiRateLimitMax: 2,
      geminiService: createGeminiService({
        generateFn: async () => VALID_AI_JSON,
      }),
      communityStore: new CommunityStore(tmpDir),
    });

    const r1 = await request(app)
      .post('/api/ai/assist')
      .send({ question: 'First check please' });
    const r2 = await request(app)
      .post('/api/ai/assist')
      .send({ question: 'Second check please' });
    const r3 = await request(app)
      .post('/api/ai/assist')
      .send({ question: 'Third check please' });

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
    expect(r3.headers['retry-after']).toBeDefined();
  });

  it('persists genuine community challenge participation and unverified user reports', async () => {
    const store = new CommunityStore(tmpDir);
    const app = createServerApp({ communityStore: store });

    const initial = await request(app).get('/api/community');
    expect(initial.status).toBe(200);
    expect(initial.body.totalVerifiedParticipants).toBe(0);

    const joinRes = await request(app).post('/api/community/participate').send({
      challengeId: 'ch-reduce-solo-trips',
      action: 'join',
      clientToken: 'anon-token-123456',
    });
    expect(joinRes.status).toBe(200);
    expect(joinRes.body.challenge.participantsCount).toBe(1);

    const repRes = await request(app).post('/api/community/reports').send({
      areaLabel: 'South Delhi',
      category: 'tip',
      title: 'Leaf composting at neighborhood park',
      description:
        'Our resident group started composting dry leaves instead of burning them.',
    });
    expect(repRes.status).toBe(201);
    expect(repRes.body.report.unverifiedUserReport).toBe(true);

    // Reload from disk to verify real persistence
    const reloaded = new CommunityStore(tmpDir).getSummary();
    expect(reloaded.totalVerifiedParticipants).toBe(1);
    expect(reloaded.reports.length).toBe(1);
  });

  it('enforces CSP header, 415 Content-Type, 413 payload limit, PII blocking, and 404 challenge checks', async () => {
    const app = createServerApp({ communityStore: new CommunityStore(tmpDir) });

    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.headers['content-security-policy']).toContain("default-src 'self'");

    const presets = await request(app).get('/api/locations/presets');
    expect(presets.status).toBe(200);
    expect(presets.body.locations.length).toBeGreaterThanOrEqual(6);

    const badGeo = await request(app).get('/api/geocode').query({ q: 'a' });
    expect(badGeo.status).toBe(400);

    const wrongMedia = await request(app)
      .post('/api/ai/assist')
      .set('Content-Type', 'text/plain')
      .send('hello');
    expect(wrongMedia.status).toBe(415);

    const hugePayload = await request(app)
      .post('/api/ai/assist')
      .send({ question: 'x'.repeat(70_000) });
    expect(hugePayload.status).toBe(413);

    const piiPost = await request(app).post('/api/community/reports').send({
      areaLabel: 'South Delhi',
      category: 'tip',
      title: 'Join our carpool',
      description: 'Call me on +91 98765 43210 to share rides daily.',
    });
    expect(piiPost.status).toBe(400);
    expect(piiPost.body.error).toContain('privacy');

    const missingChallenge = await request(app).post('/api/community/participate').send({
      challengeId: 'does-not-exist',
      action: 'join',
      clientToken: 'anon-token-abcdef',
    });
    expect(missingChallenge.status).toBe(404);
  });

  it('uses WaqiStationProvider when token is configured and caches AQI & geocode lookups', async () => {
    let waqiCalls = 0;
    let geoCalls = 0;
    const mockFetch = (async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('api.waqi.info')) {
        waqiCalls += 1;
        return new Response(
          JSON.stringify({
            status: 'ok',
            data: {
              aqi: 164,
              dominentpol: 'pm25',
              city: { name: 'Anand Vihar, Delhi (DPCC)' },
              attributions: [{ name: 'CPCB - Central Pollution Control Board' }],
              time: { iso: new Date().toISOString() },
              iaqi: { pm25: { v: 164 }, pm10: { v: 210 }, no2: { v: 42 } },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('geocoding-api.open-meteo.com')) {
        geoCalls += 1;
        return new Response(
          JSON.stringify({
            results: [
              {
                id: 10,
                name: 'Pune',
                admin1: 'Maharashtra',
                country: 'India',
                country_code: 'IN',
                latitude: 18.52,
                longitude: 73.85,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          current: {
            time: new Date().toISOString(),
            temperature_2m: 24,
            relative_humidity_2m: 50,
            wind_speed_10m: 9,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const aqService = new AirQualityService({
      waqiToken: 'test-server-token',
      fetchImpl: mockFetch,
    });
    const app = createServerApp({
      airQualityService: aqService,
      communityStore: new CommunityStore(tmpDir),
    });

    const first = await request(app).get('/api/air-quality').query({
      lat: 28.6469,
      lon: 77.316,
      name: 'New Delhi',
      country: 'India',
      countryCode: 'IN',
    });
    expect(first.status).toBe(200);
    expect(first.body.aqiStatus).toBe('measured');
    expect(first.body.cached).toBe(false);
    expect(first.body.dataSource).toContain('CPCB');

    // Second call hits cache without calling WAQI again
    const second = await request(app).get('/api/air-quality').query({
      lat: 28.6469,
      lon: 77.316,
      name: 'New Delhi',
      country: 'India',
      countryCode: 'IN',
    });
    expect(second.body.cached).toBe(true);
    expect(waqiCalls).toBe(1);

    // Explicit refresh=1 bypasses cache
    const refreshed = await request(app).get('/api/air-quality').query({
      lat: 28.6469,
      lon: 77.316,
      name: 'New Delhi',
      country: 'India',
      countryCode: 'IN',
      refresh: '1',
    });
    expect(refreshed.body.cached).toBe(false);
    expect(waqiCalls).toBe(2);

    // Geocode cache deduplicates identical searches
    await request(app).get('/api/geocode').query({ q: 'Pune' });
    await request(app).get('/api/geocode').query({ q: 'pune' });
    expect(geoCalls).toBe(1);
  });
});
