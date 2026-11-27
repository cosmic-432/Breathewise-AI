import type { AqiCategoryId, AqiScale, FreshnessStatus } from '../types/index.ts';

export interface AqiInterpretation {
  id: AqiCategoryId;
  label: string;
  shortTier: string;
  riskLevel:
    'Low' | 'Moderate' | 'Elevated' | 'High' | 'Very High' | 'Severe' | 'Unknown';
  hexColor: string;
  bgTint: string;
  textClass: string;
  healthGuidance: string;
  outdoorExerciseSafe: boolean;
  openWindowsRecommended: boolean;
}

type KnownAqiCategoryId = Exclude<AqiCategoryId, 'unavailable'>;

type AqiTierPreset = Omit<AqiInterpretation, 'id' | 'label' | 'healthGuidance'>;

interface AqiScaleBand {
  maxAqi: number;
  id: KnownAqiCategoryId;
  label: string;
  healthGuidance: string;
}

const UNAVAILABLE_INTERPRETATION: AqiInterpretation = {
  id: 'unavailable',
  label: 'Unavailable',
  shortTier: 'No reading',
  riskLevel: 'Unknown',
  hexColor: '#52645A',
  bgTint: '#EEF3F0',
  textClass: 'text-[#52645A]',
  healthGuidance:
    'Live AQI readings are currently unavailable for this location. Check local environmental agency bulletins before strenuous outdoor activity.',
  outdoorExerciseSafe: false,
  openWindowsRecommended: false,
};

const AQI_TIER_PRESETS: Record<KnownAqiCategoryId, AqiTierPreset> = {
  good: {
    shortTier: 'Tier 1 · Low Risk',
    riskLevel: 'Low',
    hexColor: '#237A57',
    bgTint: '#DDF1E6',
    textClass: 'text-[#18543F]',
    outdoorExerciseSafe: true,
    openWindowsRecommended: true,
  },
  moderate: {
    shortTier: 'Tier 2 · Moderate Risk',
    riskLevel: 'Moderate',
    hexColor: '#5B9CCB',
    bgTint: '#E6F2F9',
    textClass: 'text-[#255A7D]',
    outdoorExerciseSafe: true,
    openWindowsRecommended: true,
  },
  sensitive: {
    shortTier: 'Tier 3 · Elevated Risk',
    riskLevel: 'Elevated',
    hexColor: '#D68A35',
    bgTint: '#FCF3E6',
    textClass: 'text-[#8F5818]',
    outdoorExerciseSafe: false,
    openWindowsRecommended: false,
  },
  unhealthy: {
    shortTier: 'Tier 4 · High Risk',
    riskLevel: 'High',
    hexColor: '#C94D53',
    bgTint: '#FBECEE',
    textClass: 'text-[#962D32]',
    outdoorExerciseSafe: false,
    openWindowsRecommended: false,
  },
  very_unhealthy: {
    shortTier: 'Tier 5 · Very High Risk',
    riskLevel: 'Very High',
    hexColor: '#9E3339',
    bgTint: '#F7E1E3',
    textClass: 'text-[#7A1E24]',
    outdoorExerciseSafe: false,
    openWindowsRecommended: false,
  },
  hazardous: {
    shortTier: 'Tier 6 · Severe Risk',
    riskLevel: 'Severe',
    hexColor: '#6D1D22',
    bgTint: '#F2D5D7',
    textClass: 'text-[#5C1419]',
    outdoorExerciseSafe: false,
    openWindowsRecommended: false,
  },
};

const INDIA_NAQI_BANDS: readonly AqiScaleBand[] = [
  {
    maxAqi: 50,
    id: 'good',
    label: 'Good (CPCB NAQI)',
    healthGuidance:
      'Minimal impact. Outdoor activities and natural home ventilation are generally comfortable.',
  },
  {
    maxAqi: 100,
    id: 'moderate',
    label: 'Satisfactory (CPCB NAQI)',
    healthGuidance:
      'Minor breathing discomfort possible for unusually sensitive people. Most daily routines can proceed normally.',
  },
  {
    maxAqi: 200,
    id: 'sensitive',
    label: 'Moderate (CPCB NAQI)',
    healthGuidance:
      'Breathing discomfort possible for people with lung or heart sensitivities, children, and older adults. Reduce prolonged heavy outdoor exertion.',
  },
  {
    maxAqi: 300,
    id: 'unhealthy',
    label: 'Poor (CPCB NAQI)',
    healthGuidance:
      'Breathing discomfort likely on prolonged exposure. Move optional exercise indoors, limit outdoor time for children and older adults, and keep windows closed during smog peaks.',
  },
  {
    maxAqi: 400,
    id: 'very_unhealthy',
    label: 'Very Poor (CPCB NAQI)',
    healthGuidance:
      'Respiratory irritation likely for everyone on prolonged exposure. Avoid outdoor workouts, consolidate essential trips, use well-fitted particulate masks outdoors if required, and prioritize clean indoor air.',
  },
  {
    maxAqi: Number.POSITIVE_INFINITY,
    id: 'hazardous',
    label: 'Severe (CPCB NAQI)',
    healthGuidance:
      'Severe air pollution affecting healthy people and seriously impacting vulnerable groups. Stay indoors whenever possible, avoid outdoor exertion, keep windows sealed, and consult a doctor if experiencing breathing symptoms.',
  },
];

const US_EPA_BANDS: readonly AqiScaleBand[] = [
  {
    maxAqi: 50,
    id: 'good',
    label: 'Good',
    healthGuidance:
      'Air quality is satisfactory with little or no risk from outdoor air pollution.',
  },
  {
    maxAqi: 100,
    id: 'moderate',
    label: 'Moderate',
    healthGuidance:
      'Acceptable air quality. Unusually sensitive individuals should monitor symptoms during prolonged outdoor exertion.',
  },
  {
    maxAqi: 150,
    id: 'sensitive',
    label: 'Unhealthy for Sensitive Groups',
    healthGuidance:
      'Children, older adults, and people with respiratory or heart sensitivities should cut back prolonged or intense outdoor activity.',
  },
  {
    maxAqi: 200,
    id: 'unhealthy',
    label: 'Unhealthy',
    healthGuidance:
      'Everyone may begin to experience irritation or breathing discomfort. Move optional workouts indoors and reduce outdoor exposure.',
  },
  {
    maxAqi: 300,
    id: 'very_unhealthy',
    label: 'Very Unhealthy',
    healthGuidance:
      'Health alert: elevated risk for everyone. Avoid outdoor exercise, limit outdoor errands, keep windows closed, and run HEPA air filtration if available.',
  },
  {
    maxAqi: Number.POSITIVE_INFINITY,
    id: 'hazardous',
    label: 'Hazardous',
    healthGuidance:
      'Emergency-level air pollution. Stay indoors with filtered air where possible, avoid outdoor exertion, and seek medical care for shortness of breath, chest tightness, or wheezing.',
  },
];

/**
 * Interprets an AQI score on either the US EPA (0–500) or Indian CPCB NAQI (0–500) scale.
 * Never relies on color alone: always returns text label, risk tier, and actionable guidance.
 */
export function interpretAqi(
  aqi: number | null | undefined,
  scale: AqiScale = 'US_EPA',
): AqiInterpretation {
  if (aqi === null || aqi === undefined || Number.isNaN(aqi) || aqi < 0) {
    return UNAVAILABLE_INTERPRETATION;
  }

  const bands = scale === 'INDIA_NAQI' ? INDIA_NAQI_BANDS : US_EPA_BANDS;
  const matched = bands.find((band) => aqi <= band.maxAqi) ?? bands[bands.length - 1];
  return {
    id: matched.id,
    label: matched.label,
    healthGuidance: matched.healthGuidance,
    ...AQI_TIER_PRESETS[matched.id],
  };
}

/**
 * Computes Indian CPCB NAQI sub-index for PM2.5 (µg/m³) when reporting for Indian cities
 * alongside US EPA AQI, using official CPCB 24-hour concentration breakpoints.
 */
export function calculateIndiaNaqiFromPm25(pm25UgM3: number | null): number | null {
  if (pm25UgM3 === null || Number.isNaN(pm25UgM3) || pm25UgM3 < 0) return null;
  const breakpoints: Array<[number, number, number, number]> = [
    [0, 30, 0, 50],
    [30, 60, 51, 100],
    [60, 90, 101, 200],
    [90, 120, 201, 300],
    [120, 250, 301, 400],
    [250, 500, 401, 500],
  ];
  for (const [cLow, cHigh, iLow, iHigh] of breakpoints) {
    if (pm25UgM3 <= cHigh) {
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (pm25UgM3 - cLow) + iLow);
    }
  }
  return 500;
}

/**
 * Standard molar-mass unit conversions at 25°C, 1 atm (molar volume = 24.45 L/mol).
 * Formula: µg/m³ = ppb × (molecularWeight / 24.45)
 */
const MOLECULAR_WEIGHTS: Record<'NO2' | 'SO2' | 'O3' | 'CO', number> = {
  NO2: 46.01,
  SO2: 64.07,
  O3: 48.0,
  CO: 28.01,
};

export function ppbToUgPerM3(gas: 'NO2' | 'SO2' | 'O3' | 'CO', ppb: number): number {
  if (ppb < 0 || Number.isNaN(ppb)) {
    throw new RangeError('Concentration must be a non-negative number.');
  }
  const mw = MOLECULAR_WEIGHTS[gas];
  return Number(((ppb * mw) / 24.45).toFixed(2));
}

export function ugPerM3ToPpb(gas: 'NO2' | 'SO2' | 'O3' | 'CO', ugPerM3: number): number {
  if (ugPerM3 < 0 || Number.isNaN(ugPerM3)) {
    throw new RangeError('Concentration must be a non-negative number.');
  }
  const mw = MOLECULAR_WEIGHTS[gas];
  return Number(((ugPerM3 * 24.45) / mw).toFixed(2));
}

export function ugPerM3ToMgPerM3(ugPerM3: number): number {
  if (ugPerM3 < 0 || Number.isNaN(ugPerM3)) {
    throw new RangeError('Concentration must be a non-negative number.');
  }
  return Number((ugPerM3 / 1000).toFixed(3));
}

/**
 * Evaluates data freshness strictly. Never labels readings older than 90 minutes as "live".
 */
export function evaluateDataFreshness(
  lastUpdatedIso: string | null,
  nowMs: number = Date.now(),
): {
  status: FreshnessStatus;
  ageMinutes: number | null;
  label: string;
} {
  if (!lastUpdatedIso) {
    return {
      status: 'unavailable',
      ageMinutes: null,
      label: 'Timestamp unavailable',
    };
  }
  const parsed = Date.parse(lastUpdatedIso);
  if (Number.isNaN(parsed)) {
    return {
      status: 'unavailable',
      ageMinutes: null,
      label: 'Invalid timestamp',
    };
  }
  const ageMinutes = Math.max(0, Math.round((nowMs - parsed) / 60000));
  if (ageMinutes <= 90) {
    return {
      status: 'live',
      ageMinutes,
      label: ageMinutes <= 2 ? 'Current reading' : `Updated ${ageMinutes} min ago`,
    };
  }
  if (ageMinutes <= 360) {
    const hours = Math.round(ageMinutes / 60);
    return {
      status: 'recent',
      ageMinutes,
      label: `Recent (${hours}h old — not live)`,
    };
  }
  const hours = Math.round(ageMinutes / 60);
  return {
    status: 'stale',
    ageMinutes,
    label: `Stale (${hours}h old — do not treat as live)`,
  };
}

export function formatReadableTimestamp(iso: string | null): string {
  if (!iso) return 'Unavailable';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unavailable';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function celsiusToFahrenheit(c: number): number {
  return Number(((c * 9) / 5 + 32).toFixed(1));
}
