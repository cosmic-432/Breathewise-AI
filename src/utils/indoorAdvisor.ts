import type {
  AirQualitySnapshot,
  IndoorAdviceResult,
  IndoorConditions,
} from '../types/index.ts';
import { interpretAqi } from './aqi.ts';

/**
 * Computes general educational Clean Air Delivery Rate (CADR) sizing in m³/h.
 * Formula: Room Volume (Area m² × 2.6m standard ceiling height) × 4.5 Air Changes per Hour (ACH).
 * Note: For general educational guidance only — actual performance depends on room leakage and filter seal.
 */
export function estimateRecommendedCadrM3h(roomSizeSqm: number): number {
  const safeArea = Math.max(4, Math.min(500, roomSizeSqm));
  return Math.round(safeArea * 2.6 * 4.5);
}

/**
 * Strictly separates measured indoor data (only when user supplies an indoor sensor reading),
 * user-reported room conditions, and deterministic baseline recommendations.
 */
export function evaluateIndoorAir(
  conditions: IndoorConditions,
  outdoorSnapshot: AirQualitySnapshot | null,
): IndoorAdviceResult {
  const outdoorAqi = outdoorSnapshot?.aqi ?? null;
  const outdoorInterp = interpretAqi(outdoorAqi, outdoorSnapshot?.aqiScale ?? 'US_EPA');
  const recommendedCadrM3h = estimateRecommendedCadrM3h(conditions.roomSizeSqm);

  const hasSensorData =
    conditions.measuredIndoorPm25 !== null &&
    conditions.measuredIndoorPm25 !== undefined &&
    !Number.isNaN(conditions.measuredIndoorPm25);

  const measuredSection = hasSensorData
    ? {
        hasSensorData: true,
        pm25Value: Number(conditions.measuredIndoorPm25),
        sensorLabel: conditions.sensorLabel || 'User-entered indoor sensor',
        summary: `User-reported indoor sensor reading: ${conditions.measuredIndoorPm25} µg/m³ PM2.5 (${conditions.sensorLabel || 'personal monitor'}). Note: Consumer sensor accuracy varies by calibration.`,
      }
    : {
        hasSensorData: false,
        pm25Value: null,
        summary:
          'Not measured — no indoor air sensor reading was provided. BreatheWise AI does not invent indoor AQI numbers.',
      };

  const reportedConditionsSummary: string[] = [
    `Room size: ~${conditions.roomSizeSqm} m² (${Math.round(conditions.roomSizeSqm * 10.764)} sq ft) with ${conditions.occupants} occupant(s)`,
    `Ventilation: ${conditions.ventilation.replace(/_/g, ' ')}`,
    `Cooking fuel: ${conditions.cookingFuel.replace(/_/g, ' ')}`,
    `Air purifier: ${conditions.hasPurifier ? `Yes (${conditions.filterType.replace(/_/g, ' ')})` : 'None reported'}`,
  ];

  if (
    conditions.indoorHumidityPercent !== null &&
    conditions.indoorHumidityPercent !== undefined
  ) {
    reportedConditionsSummary.push(
      `Reported indoor humidity: ${conditions.indoorHumidityPercent}%`,
    );
  }
  if (conditions.nearbySources.length > 0) {
    reportedConditionsSummary.push(
      `Nearby sources: ${conditions.nearbySources.join(', ')}`,
    );
  }

  let ventilationStrategy: string;
  if (outdoorInterp.id === 'unavailable') {
    ventilationStrategy =
      'Outdoor AQI is unavailable. Use kitchen exhaust during cooking and check local air-quality bulletins before wide cross-ventilation.';
  } else if (!outdoorInterp.openWindowsRecommended) {
    ventilationStrategy = `Outdoor air is currently ${outdoorInterp.label} (AQI ${outdoorAqi}). Opening windows is NOT beneficial right now because it pulls outdoor PM2.5 indoors. Keep exterior windows and doors closed during smog peaks, seal visible gaps, and ventilate briefly only if outdoor AQI improves or when cooking fumes require exhaust.`;
  } else {
    ventilationStrategy = `Outdoor air is currently ${outdoorInterp.label} (AQI ${outdoorAqi}). Brief cross-ventilation (15–30 minutes) can help refresh indoor CO2 and clear household odors, while still using kitchen exhaust when cooking.`;
  }

  const priorityActions: IndoorAdviceResult['priorityActions'] = [];

  if (
    !outdoorInterp.openWindowsRecommended &&
    conditions.ventilation === 'natural_windows'
  ) {
    priorityActions.push({
      title: 'Close windows during outdoor pollution peaks',
      detail:
        'Natural window ventilation brings outdoor smog indoors when AQI is elevated. Close windows facing roads and use indoor filtration or brief midday airing only if outdoor AQI drops.',
      category: 'ventilation',
    });
  }

  if (conditions.indoorSmoking) {
    priorityActions.push({
      title: 'Eliminate indoor tobacco smoke',
      detail:
        'Indoor smoking creates very high indoor PM2.5 and lingering gases that household purifiers cannot completely remove immediately. Keep the home strictly smoke-free.',
      category: 'source_control',
    });
  }

  if (conditions.usesIncenseOrCandles) {
    priorityActions.push({
      title: 'Avoid unnecessary incense, dhoop, and scented candles',
      detail:
        'Burning incense or candles indoors releases fine particulate matter and smoke directly into breathing zones, especially problematic when windows must stay closed.',
      category: 'source_control',
    });
  }

  if (
    conditions.cookingFuel === 'solid_biomass_coal' ||
    conditions.cookingFuel === 'mixed'
  ) {
    priorityActions.push({
      title: 'Prioritize cleaner cooking and active kitchen exhaust',
      detail:
        'Solid fuels release heavy indoor PM2.5 and carbon monoxide. Transitioning to LPG or electric induction and running a vented range hood or exhaust fan during cooking dramatically cuts indoor smoke.',
      category: 'source_control',
    });
  } else {
    priorityActions.push({
      title: 'Run kitchen exhaust during and 15 minutes after cooking',
      detail:
        'High-heat frying and gas burners generate fine particles and NO2 indoors. Turn on an externally vented exhaust fan or chimney before heating oil.',
      category: 'ventilation',
    });
  }

  const ozoneWarning = conditions.filterType === 'ionizer_ozone';
  if (ozoneWarning) {
    priorityActions.push({
      title: 'Avoid ozone-generating or uncertified ionizer devices',
      detail:
        'Ozone is a lung irritant that can worsen respiratory symptoms. Prefer mechanical True HEPA filtration without ozone generation.',
      category: 'filtration',
    });
  } else if (conditions.hasPurifier) {
    priorityActions.push({
      title: 'Maintain air purifier placement and filter schedule',
      detail:
        'Keep purifier intake unobstructed (at least 30 cm from walls), vacuum washable pre-filters monthly, and replace HEPA filters on schedule—more frequently during severe winter smog.',
      category: 'filtration',
    });
  } else {
    priorityActions.push({
      title: 'Reduce settled indoor dust with damp cleaning',
      detail:
        'Damp-mop hard floors and wipe surfaces with a wet microfiber cloth instead of dry sweeping, which resuspends fine dust into indoor air.',
      category: 'source_control',
    });
  }

  if (
    conditions.indoorHumidityPercent !== null &&
    conditions.indoorHumidityPercent !== undefined
  ) {
    if (conditions.indoorHumidityPercent > 60) {
      priorityActions.push({
        title: 'Manage high indoor humidity (above 60%)',
        detail:
          'Elevated humidity encourages mold and dust mites. Use bathroom/kitchen exhaust fans and fix damp leaks; aim for 40–55% relative humidity.',
        category: 'humidity',
      });
    } else if (conditions.indoorHumidityPercent < 30) {
      priorityActions.push({
        title: 'Address very dry indoor air (below 30%)',
        detail:
          'Very dry air can irritate airways alongside particulate pollution. If using a humidifier, clean it regularly and use distilled/boiled-cooled water to avoid mineral dust.',
        category: 'humidity',
      });
    }
  }

  const purifierGuidance = `For a ~${conditions.roomSizeSqm} m² room (assuming ~2.6 m ceiling height), general guidance for 4–5 air changes per hour is a mechanical True HEPA air purifier rated near ${recommendedCadrM3h} m³/h CADR. Look for sealed True HEPA (H13/H14) plus activated carbon if odors/VOCs are present, and avoid ozone-generating devices.`;

  return {
    measuredSection,
    reportedConditionsSummary,
    recommendedCadrM3h,
    ventilationStrategy,
    priorityActions,
    purifierGuidance,
    ozoneWarning,
  };
}
