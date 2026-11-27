import type {
  AirQualitySnapshot,
  HouseholdProfile,
  RoutineActivity,
  RoutineRecommendation,
  TimeBlock,
} from '../types/index.ts';
import { interpretAqi } from './aqi.ts';

const BLOCK_HOURS: Record<TimeBlock, [number, number]> = {
  morning: [6, 11],
  afternoon: [12, 16],
  evening: [17, 20],
  night: [21, 23],
};

function findBestForecastWindow(
  snapshot: AirQualitySnapshot | null,
): { windowLabel: string; minAqi: number } | null {
  if (!snapshot || snapshot.hourlyForecast.length === 0) return null;

  const valid = snapshot.hourlyForecast.filter(
    (pt): pt is typeof pt & { aqi: number } =>
      pt.aqi !== null && !Number.isNaN(pt.aqi) && pt.status !== 'unavailable',
  );
  if (valid.length < 3) return null;

  let best = valid[0];
  for (const pt of valid.slice(0, 24)) {
    if (pt.aqi < best.aqi) {
      best = pt;
    }
  }

  // Only suggest an alternate window if the forecast genuinely shows a meaningful drop (>= 15 AQI lower)
  if (snapshot.aqi !== null && best.aqi >= snapshot.aqi - 15) {
    return null;
  }

  const d = new Date(best.time);
  if (Number.isNaN(d.getTime())) return null;
  const hour = d.getHours();
  const formattedHour = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  let period: string;
  if (hour >= 6 && hour <= 11) period = 'morning';
  else if (hour >= 12 && hour <= 16) period = 'afternoon';
  else if (hour >= 17 && hour <= 20) period = 'evening';
  else period = 'night';

  return {
    windowLabel: `Around ${formattedHour} (${period}, forecast AQI ~${best.aqi})`,
    minAqi: best.aqi,
  };
}

interface ForecastWindow {
  windowLabel: string;
  minAqi: number;
}

interface RoutinePlanningContext {
  blockLabel: string;
  bestWindow: ForecastWindow | null;
  isSeverelyPolluted: boolean;
  isElevated: boolean;
  hasVulnerableGroup: boolean;
}

interface RoutineCategoryPlan {
  recommendedTiming: string;
  lowerExposureAlternatives: string[];
  sustainableTransportOptions: string[];
  practicalActions: string[];
  healthOverEmissionsNote?: string;
}

function buildUnavailableRecommendation(
  activity: RoutineActivity,
  blockLabel: string,
): RoutineRecommendation {
  return {
    activityId: activity.id,
    recommendedTiming: `${blockLabel} — verify local AQI before departing`,
    exposureLevel: 'unknown',
    exposureConsiderations:
      'Live AQI data is currently unavailable for your selected location. Treat outdoor visibility haze or smoke smell as a cue to shorten outdoor exposure.',
    lowerExposureAlternatives: [
      activity.isOutdoor
        ? 'Keep an indoor backup option ready until current air-quality readings are verified.'
        : 'Indoor activity has lower direct outdoor exposure if windows stay closed during visible haze.',
    ],
    sustainableTransportOptions: [
      'Where conditions are clear and safe, consider shared transit or combining nearby stops.',
    ],
    practicalActions: [
      'Refresh air-quality readings before leaving.',
      'Avoid strenuous outdoor exertion if haze or smoke is noticeable.',
    ],
    reasoning:
      'Because live AQI data is unavailable, BreatheWise AI avoids fabricating forecast times and provides precautionary general guidance.',
    basedOnForecast: false,
  };
}

function buildExercisePlan(ctx: RoutinePlanningContext): RoutineCategoryPlan {
  if (ctx.isSeverelyPolluted || (ctx.isElevated && ctx.hasVulnerableGroup)) {
    return {
      recommendedTiming: ctx.bestWindow
        ? `Move indoors today; if outdoor step-out is essential, ${ctx.bestWindow.windowLabel} shows lower forecast pollution`
        : 'Move indoors today — outdoor air quality is too poor for outdoor exercise',
      lowerExposureAlternatives: [
        'Shift workout indoors (stretching, strength training, yoga, or indoor treadmill in a filtered room).',
        'Reduce breathing intensity and session length if stepping outside is unavoidable.',
      ],
      sustainableTransportOptions: [],
      practicalActions: [
        'Avoid jogging, brisk walking, or cycling along traffic corridors during poor AQI.',
        'Keep indoor air clean during workouts by avoiding incense/smoke and running HEPA filtration if available.',
      ],
      healthOverEmissionsNote:
        'Protecting lung health takes priority over active-transport emission savings when air is heavily polluted. Never exercise or cycle through severe smog simply because it is low-emission.',
    };
  }
  if (ctx.isElevated) {
    return {
      recommendedTiming: ctx.bestWindow
        ? `Consider shifting to ${ctx.bestWindow.windowLabel}, or shorten duration indoors`
        : `${ctx.blockLabel} — keep intensity light and duration shorter`,
      lowerExposureAlternatives: [
        'Choose indoor exercise or reduce high-intensity cardio outdoors.',
        'Use parks or quieter streets set back from busy roads.',
      ],
      sustainableTransportOptions: [],
      practicalActions: [
        'Monitor for coughing, throat irritation, or fatigue and stop early if needed.',
      ],
    };
  }
  return {
    recommendedTiming: `${ctx.blockLabel} — suitable under current conditions`,
    lowerExposureAlternatives: [
      'Current air quality supports outdoor movement; still prefer tree-lined paths away from heavy diesel traffic.',
    ],
    sustainableTransportOptions: [
      'Walking or cycling is safe and low-emission under current air-quality conditions.',
    ],
    practicalActions: [
      'Hydrate well and check AQI again if smog tends to build later in the evening.',
    ],
  };
}

function buildCommutePlan(ctx: RoutinePlanningContext): RoutineCategoryPlan {
  if (ctx.isSeverelyPolluted) {
    return {
      recommendedTiming: ctx.bestWindow
        ? `${ctx.blockLabel} (fixed commute) — if flexible, ${ctx.bestWindow.windowLabel} has lower forecast AQI`
        : `${ctx.blockLabel} — minimize open-air waiting time and roadside exposure`,
      lowerExposureAlternatives: [
        'If remote study or work-from-home is permitted on severe smog days, consider using it.',
        'Use enclosed metro, air-conditioned bus, or carpool with cabin air set to recirculate rather than open-air two-wheelers or cycling.',
      ],
      sustainableTransportOptions: [
        'Enclosed metro or shared carpool reduces both per-person vehicle emissions and open-air particulate inhalation compared to solo driving or open two-wheelers.',
      ],
      practicalActions: [
        'Wear a well-fitted N95/FFP2 respirator during outdoor walks to stops or stations.',
        'Set vehicle cabin ventilation to recirculation mode in heavy traffic, briefly refreshing air in clearer stretches.',
      ],
      healthOverEmissionsNote:
        'During severe pollution, skip cycling or long roadside walks even though they are zero-emission—enclosed public transit or shared carpooling balances exposure safety and lower emissions.',
    };
  }
  if (ctx.isElevated) {
    return {
      recommendedTiming: ctx.bestWindow
        ? `${ctx.blockLabel} — forecast suggests slightly cleaner air ${ctx.bestWindow.windowLabel}`
        : `${ctx.blockLabel} — reduce roadside waiting where possible`,
      lowerExposureAlternatives: [
        'Prefer enclosed public transit or carpooling over open-air two-wheelers along congested corridors.',
      ],
      sustainableTransportOptions: [
        'Metro, bus, or carpooling cuts solo car trips while limiting direct roadside exhaust inhalation.',
      ],
      practicalActions: [
        'Check wait times before walking out so you spend less time standing next to idling vehicles.',
      ],
    };
  }
  return {
    recommendedTiming: `${ctx.blockLabel} — suitable under current conditions`,
    lowerExposureAlternatives: [
      'Choose side streets over main arterial roads when walking or cycling.',
    ],
    sustainableTransportOptions: [
      'Good conditions for public transit, carpooling, or walking/cycling on safe routes.',
    ],
    practicalActions: [
      'Plan return commute ahead of peak evening traffic when possible.',
    ],
  };
}

function buildErrandPlan(ctx: RoutinePlanningContext): RoutineCategoryPlan {
  if (ctx.isElevated) {
    return {
      recommendedTiming: ctx.bestWindow
        ? `Consolidate errands and aim for ${ctx.bestWindow.windowLabel}`
        : `Combine errands into one short trip during ${ctx.blockLabel} or defer non-urgent trips`,
      lowerExposureAlternatives: [
        'Combine multiple errands into a single trip or use consolidated delivery to avoid repeated outdoor exposure.',
      ],
      sustainableTransportOptions: [
        'Trip consolidation reduces both your personal smog exposure and vehicle cold-start emissions.',
      ],
      practicalActions: [
        'Keep a single list so you spend minimal time walking between open-air markets or parking areas.',
      ],
    };
  }
  return {
    recommendedTiming: `${ctx.blockLabel} — suitable under current conditions`,
    lowerExposureAlternatives: ['Plan stops in sequence to avoid backtracking.'],
    sustainableTransportOptions: [
      'Combine errands on foot, by bicycle, or via one shared transit trip.',
    ],
    practicalActions: ['Carry reusable bags and group weekly purchases.'],
  };
}

function buildOutdoorWorkPlan(ctx: RoutinePlanningContext): RoutineCategoryPlan {
  if (ctx.isElevated) {
    return {
      recommendedTiming: ctx.bestWindow
        ? `Schedule heaviest outdoor tasks near ${ctx.bestWindow.windowLabel}`
        : `${ctx.blockLabel} — rotate tasks with indoor rest breaks`,
      lowerExposureAlternatives: [
        'Shift administrative or prep work indoors during peak pollution hours.',
        'Take frequent short breaks in a cleaner indoor space.',
      ],
      sustainableTransportOptions: [],
      practicalActions: [
        'Use a well-fitted N95/KN95/FFP2 mask when working outdoors in high PM2.5.',
        'Drink water regularly and stop work to seek medical help if experiencing chest tightness or dizziness.',
      ],
      healthOverEmissionsNote:
        'For outdoor workers, reducing respiratory exposure is the primary concern; avoid heavy unmasked exertion during poor air alerts.',
    };
  }
  return {
    recommendedTiming: `${ctx.blockLabel} — suitable under current conditions`,
    lowerExposureAlternatives: [
      'Position work areas upwind of generators or idling vehicles.',
    ],
    sustainableTransportOptions: [],
    practicalActions: [
      'Keep protective mask handy if dust or nearby construction spikes localized particulate levels.',
    ],
  };
}

function buildFamilyPlan(ctx: RoutinePlanningContext): RoutineCategoryPlan {
  if (ctx.isElevated) {
    return {
      recommendedTiming: ctx.bestWindow
        ? `Keep family plans indoors; brief outdoor time is cleaner ${ctx.bestWindow.windowLabel}`
        : 'Shift family gathering indoors today to protect children and older adults',
      lowerExposureAlternatives: [
        'Choose indoor libraries, home games, or filtered indoor spaces instead of outdoor parks.',
      ],
      sustainableTransportOptions: [
        'If traveling together, share a single vehicle with cabin recirculation or enclosed transit.',
      ],
      practicalActions: [
        'Keep children’s outdoor play brief and non-strenuous during elevated AQI.',
        'Have older adults and sensitive family members keep prescribed rescue medications accessible.',
      ],
    };
  }
  return {
    recommendedTiming: `${ctx.blockLabel} — suitable under current conditions`,
    lowerExposureAlternatives: [
      'Outdoor parks away from major roads are comfortable for family outings.',
    ],
    sustainableTransportOptions: ['Walk together or take shared transit to local parks.'],
    practicalActions: [
      'Check evening AQI before sunset, as winter inversion layers can trap smog quickly.',
    ],
  };
}

function selectCategoryPlan(
  category: RoutineActivity['category'],
  ctx: RoutinePlanningContext,
): RoutineCategoryPlan {
  switch (category) {
    case 'exercise':
    case 'walking':
      return buildExercisePlan(ctx);
    case 'school_college_commute':
    case 'office_commute':
      return buildCommutePlan(ctx);
    case 'shopping':
    case 'other':
      return buildErrandPlan(ctx);
    case 'outdoor_work':
      return buildOutdoorWorkPlan(ctx);
    case 'family_activities':
      return buildFamilyPlan(ctx);
  }
}

/**
 * Generates deterministic, safety-first recommendations for a user's daily routine activity.
 * Enforces the core rule: NEVER recommend cycling or outdoor exercise through heavily polluted air
 * just because it produces lower vehicle emissions.
 */
export function generateRoutineRecommendation(
  activity: RoutineActivity,
  snapshot: AirQualitySnapshot | null,
  household: HouseholdProfile,
): RoutineRecommendation {
  const aqi = snapshot?.aqi ?? null;
  const scale = snapshot?.aqiScale ?? 'US_EPA';
  const interpretation = interpretAqi(aqi, scale);
  const hasVulnerableGroup =
    household.ageGroups.includes('children_under_12') ||
    household.ageGroups.includes('older_adults_65_plus') ||
    household.sensitivities.includes('respiratory_sensitivity') ||
    household.sensitivities.includes('cardiovascular_sensitivity') ||
    household.sensitivities.includes('pregnancy');

  const bestWindow = findBestForecastWindow(snapshot);
  const [startH, endH] = BLOCK_HOURS[activity.preferredBlock];
  const blockLabel = `${activity.preferredBlock.charAt(0).toUpperCase()}${activity.preferredBlock.slice(1)} (${startH}:00–${endH}:00)`;

  if (interpretation.id === 'unavailable') {
    return buildUnavailableRecommendation(activity, blockLabel);
  }

  const isSeverelyPolluted =
    interpretation.id === 'unhealthy' ||
    interpretation.id === 'very_unhealthy' ||
    interpretation.id === 'hazardous';
  const isElevated = interpretation.id === 'sensitive' || isSeverelyPolluted;

  let exposureLevel: RoutineRecommendation['exposureLevel'] = 'low';
  if (interpretation.id === 'moderate') exposureLevel = 'moderate';
  if (interpretation.id === 'sensitive') exposureLevel = 'elevated';
  if (isSeverelyPolluted) exposureLevel = 'high';

  const plan = selectCategoryPlan(activity.category, {
    blockLabel,
    bestWindow,
    isSeverelyPolluted,
    isElevated,
    hasVulnerableGroup,
  });

  const reasoningParts = [
    `Based on ${snapshot?.aqiStatus === 'measured' ? 'measured' : 'model-estimated'} AQI ${aqi} (${interpretation.label}) from ${snapshot?.dataSource ?? 'current data'}.`,
  ];
  if (hasVulnerableGroup) {
    reasoningParts.push(
      'Adjusted for household sensitivity profile (children, older adults, or health sensitivities selected).',
    );
  }
  if (bestWindow) {
    reasoningParts.push(
      `Hourly forecast indicates lower pollution ${bestWindow.windowLabel}.`,
    );
  } else {
    reasoningParts.push(
      'No alternate time window is recommended unless hourly forecast data supports a meaningful improvement.',
    );
  }

  return {
    activityId: activity.id,
    recommendedTiming: plan.recommendedTiming,
    exposureLevel,
    exposureConsiderations: interpretation.healthGuidance,
    lowerExposureAlternatives: plan.lowerExposureAlternatives,
    sustainableTransportOptions: plan.sustainableTransportOptions,
    practicalActions: plan.practicalActions,
    reasoning: reasoningParts.join(' '),
    healthOverEmissionsNote: plan.healthOverEmissionsNote,
    basedOnForecast: Boolean(bestWindow),
  };
}
