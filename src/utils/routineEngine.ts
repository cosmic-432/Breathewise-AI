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
  let period = 'daytime';
  if (hour >= 6 && hour <= 11) period = 'morning';
  else if (hour >= 12 && hour <= 16) period = 'afternoon';
  else if (hour >= 17 && hour <= 20) period = 'evening';
  else period = 'night';

  return {
    windowLabel: `Around ${formattedHour} (${period}, forecast AQI ~${best.aqi})`,
    minAqi: best.aqi,
  };
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

  const isSeverelyPolluted =
    interpretation.id === 'unhealthy' ||
    interpretation.id === 'very_unhealthy' ||
    interpretation.id === 'hazardous';
  const isElevated = interpretation.id === 'sensitive' || isSeverelyPolluted;

  let exposureLevel: RoutineRecommendation['exposureLevel'] = 'low';
  if (interpretation.id === 'moderate') exposureLevel = 'moderate';
  if (interpretation.id === 'sensitive') exposureLevel = 'elevated';
  if (isSeverelyPolluted) exposureLevel = 'high';

  const lowerExposureAlternatives: string[] = [];
  const sustainableTransportOptions: string[] = [];
  const practicalActions: string[] = [];
  let recommendedTiming = `${blockLabel} — suitable under current conditions`;
  let healthOverEmissionsNote: string | undefined;

  if (activity.category === 'exercise' || activity.category === 'walking') {
    if (isSeverelyPolluted || (isElevated && hasVulnerableGroup)) {
      recommendedTiming = bestWindow
        ? `Move indoors today; if outdoor step-out is essential, ${bestWindow.windowLabel} shows lower forecast pollution`
        : 'Move indoors today — outdoor air quality is too poor for outdoor exercise';
      lowerExposureAlternatives.push(
        'Shift workout indoors (stretching, strength training, yoga, or indoor treadmill in a filtered room).',
        'Reduce breathing intensity and session length if stepping outside is unavoidable.',
      );
      practicalActions.push(
        'Avoid jogging, brisk walking, or cycling along traffic corridors during poor AQI.',
        'Keep indoor air clean during workouts by avoiding incense/smoke and running HEPA filtration if available.',
      );
      healthOverEmissionsNote =
        'Protecting lung health takes priority over active-transport emission savings when air is heavily polluted. Never exercise or cycle through severe smog simply because it is low-emission.';
    } else if (isElevated) {
      recommendedTiming = bestWindow
        ? `Consider shifting to ${bestWindow.windowLabel}, or shorten duration indoors`
        : `${blockLabel} — keep intensity light and duration shorter`;
      lowerExposureAlternatives.push(
        'Choose indoor exercise or reduce high-intensity cardio outdoors.',
        'Use parks or quieter streets set back from busy roads.',
      );
      practicalActions.push('Monitor for coughing, throat irritation, or fatigue and stop early if needed.');
    } else {
      lowerExposureAlternatives.push('Current air quality supports outdoor movement; still prefer tree-lined paths away from heavy diesel traffic.');
      sustainableTransportOptions.push('Walking or cycling is safe and low-emission under current air-quality conditions.');
      practicalActions.push('Hydrate well and check AQI again if smog tends to build later in the evening.');
    }
  } else if (
    activity.category === 'school_college_commute' ||
    activity.category === 'office_commute'
  ) {
    if (isSeverelyPolluted) {
      recommendedTiming = bestWindow
        ? `${blockLabel} (fixed commute) — if flexible, ${bestWindow.windowLabel} has lower forecast AQI`
        : `${blockLabel} — minimize open-air waiting time and roadside exposure`;
      lowerExposureAlternatives.push(
        'If remote study or work-from-home is permitted on severe smog days, consider using it.',
        'Use enclosed metro, air-conditioned bus, or carpool with cabin air set to recirculate rather than open-air two-wheelers or cycling.',
      );
      sustainableTransportOptions.push(
        'Enclosed metro or shared carpool reduces both per-person vehicle emissions and open-air particulate inhalation compared to solo driving or open two-wheelers.',
      );
      practicalActions.push(
        'Wear a well-fitted N95/FFP2 respirator during outdoor walks to stops or stations.',
        'Set vehicle cabin ventilation to recirculation mode in heavy traffic, briefly refreshing air in clearer stretches.',
      );
      healthOverEmissionsNote =
        'During severe pollution, skip cycling or long roadside walks even though they are zero-emission—enclosed public transit or shared carpooling balances exposure safety and lower emissions.';
    } else if (isElevated) {
      recommendedTiming = bestWindow
        ? `${blockLabel} — forecast suggests slightly cleaner air ${bestWindow.windowLabel}`
        : `${blockLabel} — reduce roadside waiting where possible`;
      lowerExposureAlternatives.push(
        'Prefer enclosed public transit or carpooling over open-air two-wheelers along congested corridors.',
      );
      sustainableTransportOptions.push(
        'Metro, bus, or carpooling cuts solo car trips while limiting direct roadside exhaust inhalation.',
      );
      practicalActions.push(
        'Check wait times before walking out so you spend less time standing next to idling vehicles.',
      );
    } else {
      sustainableTransportOptions.push(
        'Good conditions for public transit, carpooling, or walking/cycling on safe routes.',
      );
      lowerExposureAlternatives.push('Choose side streets over main arterial roads when walking or cycling.');
      practicalActions.push('Plan return commute ahead of peak evening traffic when possible.');
    }
  } else if (activity.category === 'shopping' || activity.category === 'other') {
    if (isElevated) {
      recommendedTiming = bestWindow
        ? `Consolidate errands and aim for ${bestWindow.windowLabel}`
        : `Combine errands into one short trip during ${blockLabel} or defer non-urgent trips`;
      lowerExposureAlternatives.push(
        'Combine multiple errands into a single trip or use consolidated delivery to avoid repeated outdoor exposure.',
      );
      sustainableTransportOptions.push(
        'Trip consolidation reduces both your personal smog exposure and vehicle cold-start emissions.',
      );
      practicalActions.push(
        'Keep a single list so you spend minimal time walking between open-air markets or parking areas.',
      );
    } else {
      sustainableTransportOptions.push(
        'Combine errands on foot, by bicycle, or via one shared transit trip.',
      );
      lowerExposureAlternatives.push('Plan stops in sequence to avoid backtracking.');
      practicalActions.push('Carry reusable bags and group weekly purchases.');
    }
  } else if (activity.category === 'outdoor_work') {
    if (isElevated) {
      recommendedTiming = bestWindow
        ? `Schedule heaviest outdoor tasks near ${bestWindow.windowLabel}`
        : `${blockLabel} — rotate tasks with indoor rest breaks`;
      lowerExposureAlternatives.push(
        'Shift administrative or prep work indoors during peak pollution hours.',
        'Take frequent short breaks in a cleaner indoor space.',
      );
      practicalActions.push(
        'Use a well-fitted N95/KN95/FFP2 mask when working outdoors in high PM2.5.',
        'Drink water regularly and stop work to seek medical help if experiencing chest tightness or dizziness.',
      );
      healthOverEmissionsNote =
        'For outdoor workers, reducing respiratory exposure is the primary concern; avoid heavy unmasked exertion during poor air alerts.';
    } else {
      practicalActions.push('Keep protective mask handy if dust or nearby construction spikes localized particulate levels.');
      lowerExposureAlternatives.push('Position work areas upwind of generators or idling vehicles.');
    }
  } else {
    // family_activities
    if (isElevated) {
      recommendedTiming = bestWindow
        ? `Keep family plans indoors; brief outdoor time is cleaner ${bestWindow.windowLabel}`
        : 'Shift family gathering indoors today to protect children and older adults';
      lowerExposureAlternatives.push(
        'Choose indoor libraries, home games, or filtered indoor spaces instead of outdoor parks.',
      );
      sustainableTransportOptions.push(
        'If traveling together, share a single vehicle with cabin recirculation or enclosed transit.',
      );
      practicalActions.push(
        'Keep children’s outdoor play brief and non-strenuous during elevated AQI.',
        'Have older adults and sensitive family members keep prescribed rescue medications accessible.',
      );
    } else {
      lowerExposureAlternatives.push('Outdoor parks away from major roads are comfortable for family outings.');
      sustainableTransportOptions.push('Walk together or take shared transit to local parks.');
      practicalActions.push('Check evening AQI before sunset, as winter inversion layers can trap smog quickly.');
    }
  }

  const reasoningParts = [
    `Based on ${snapshot?.aqiStatus === 'measured' ? 'measured' : 'model-estimated'} AQI ${aqi} (${interpretation.label}) from ${snapshot?.dataSource ?? 'current data'}.`,
  ];
  if (hasVulnerableGroup) {
    reasoningParts.push(
      'Adjusted for household sensitivity profile (children, older adults, or health sensitivities selected).',
    );
  }
  if (bestWindow) {
    reasoningParts.push(`Hourly forecast indicates lower pollution ${bestWindow.windowLabel}.`);
  } else {
    reasoningParts.push('No alternate time window is recommended unless hourly forecast data supports a meaningful improvement.');
  }

  return {
    activityId: activity.id,
    recommendedTiming,
    exposureLevel,
    exposureConsiderations: interpretation.healthGuidance,
    lowerExposureAlternatives,
    sustainableTransportOptions,
    practicalActions,
    reasoning: reasoningParts.join(' '),
    healthOverEmissionsNote,
    basedOnForecast: Boolean(bestWindow),
  };
}
