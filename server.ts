import 'dotenv/config';
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import {
  aiAssistantRequestSchema,
  communityJoinSchema,
  communityReportSchema,
  coordinatesQuerySchema,
  geocodeQuerySchema,
} from './src/schemas/index.ts';
import {
  AirQualityService,
  PRESET_LOCATIONS,
} from './src/services/providers/airQualityProvider.ts';
import { createGeminiService, GeminiServiceError } from './src/services/geminiService.ts';
import { createRateLimiter } from './src/server/rateLimiter.ts';
import { CommunityStore } from './src/server/communityStore.ts';
import type { LocationSelection } from './src/types/index.ts';
import { getNumericHttpStatus } from './src/utils/typeGuards.ts';

export interface ServerDependencies {
  airQualityService?: AirQualityService;
  geminiService?: ReturnType<typeof createGeminiService>;
  communityStore?: CommunityStore;
  aiRateLimitMax?: number;
  apiRateLimitMax?: number;
}

export function createServerApp(deps?: ServerDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const airQualityService =
    deps?.airQualityService ??
    new AirQualityService({ waqiToken: process.env.WAQI_API_TOKEN });
  const geminiService = deps?.geminiService ?? createGeminiService();
  const communityStore = deps?.communityStore ?? new CommunityStore();

  const apiLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: deps?.apiRateLimitMax ?? 100,
    keyPrefix: 'api',
  });
  const aiLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: deps?.aiRateLimitMax ?? 15,
    keyPrefix: 'ai',
  });

  // Security headers (iframe-safe for AI Studio preview: no X-Frame-Options)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), payment=(), geolocation=(self)',
    );
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
        "connect-src 'self' https://air-quality-api.open-meteo.com https://api.open-meteo.com https://geocoding-api.open-meteo.com",
        "object-src 'none'",
        "base-uri 'self'",
      ].join('; '),
    );
    next();
  });

  // Require application/json on API POST mutations
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST' && !req.is('application/json')) {
      res.status(415).json({
        error: 'Content-Type must be application/json.',
        code: 'UNSUPPORTED_MEDIA_TYPE',
      });
      return;
    }
    next();
  });

  // Strict JSON payload size limit
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/locations/presets', apiLimiter.middleware, (_req, res) => {
    res.json({ locations: PRESET_LOCATIONS });
  });

  app.get('/api/geocode', apiLimiter.middleware, async (req, res, next) => {
    try {
      const parsed = geocodeQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          error: parsed.error.issues[0]?.message ?? 'Invalid search query.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }
      const results = await airQualityService.searchLocations(parsed.data.q);
      res.json({ results });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/air-quality', apiLimiter.middleware, async (req, res, next) => {
    try {
      const parsed = coordinatesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Valid latitude (-90 to 90) and longitude (-180 to 180) are required.',
          code: 'VALIDATION_ERROR',
          details: parsed.error.issues.map((i) => i.message),
        });
        return;
      }

      const d = parsed.data;
      const location: LocationSelection = {
        id: `loc-${d.lat.toFixed(3)}-${d.lon.toFixed(3)}`,
        name: d.name ?? `Coordinates (${d.lat.toFixed(2)}, ${d.lon.toFixed(2)})`,
        neighborhood: d.neighborhood,
        region: d.region,
        country: d.country ?? 'Unknown',
        countryCode: (d.countryCode ?? 'XX').toUpperCase(),
        latitude: d.lat,
        longitude: d.lon,
        source: d.source ?? 'search',
      };

      const bypassCache = req.query.refresh === '1';
      const snapshot = await airQualityService.getSnapshot(location, bypassCache);
      res.setHeader('Cache-Control', 'no-store');
      res.json(snapshot);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/ai/assist', aiLimiter.middleware, async (req, res, next) => {
    try {
      const parsed = aiAssistantRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: parsed.error.issues[0]?.message ?? 'Invalid AI request payload.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const structured = await geminiService.generateGuidance(parsed.data);
      res.json({ response: structured });
    } catch (err) {
      if (err instanceof GeminiServiceError) {
        res.status(err.statusCode).json({
          error: err.message,
          code: err.code,
        });
        return;
      }
      next(err);
    }
  });

  app.get('/api/community', apiLimiter.middleware, (_req, res) => {
    res.json(communityStore.getSummary());
  });

  app.post('/api/community/participate', apiLimiter.middleware, (req, res) => {
    const parsed = communityJoinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Invalid participation request.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    const updated = communityStore.participate(
      parsed.data.challengeId,
      parsed.data.action,
      parsed.data.clientToken,
    );
    if (!updated) {
      res.status(404).json({
        error: 'Community challenge not found.',
        code: 'NOT_FOUND',
      });
      return;
    }
    res.json({ challenge: updated, summary: communityStore.getSummary() });
  });

  app.post('/api/community/reports', apiLimiter.middleware, (req, res) => {
    const parsed = communityReportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'Invalid community post.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    const report = communityStore.addReport(parsed.data);
    res.status(201).json({ report, summary: communityStore.getSummary() });
  });

  // Malformed JSON / centralized safe error handler (never leaks internals or secrets)
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    const httpStatus = getNumericHttpStatus(err);
    if (err instanceof SyntaxError && httpStatus === 400) {
      res.status(400).json({
        error: 'Malformed JSON request body.',
        code: 'MALFORMED_JSON',
      });
      return;
    }
    if (httpStatus === 413) {
      res.status(413).json({
        error: 'Request payload is too large.',
        code: 'PAYLOAD_TOO_LARGE',
      });
      return;
    }
    res.status(500).json({
      error: 'An unexpected server error occurred. Please try again.',
      code: 'INTERNAL_ERROR',
    });
  });

  return app;
}

async function startServer(): Promise<void> {
  const app = createServerApp();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BreatheWise AI server running on http://0.0.0.0:${PORT}`);
  });
}

const isDirectEntry =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectEntry) {
  void startServer();
}
