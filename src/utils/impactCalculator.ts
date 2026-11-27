import type {
  HouseholdProfile,
  ImpactActionType,
  ImpactCalculationResult,
} from '../types/index.ts';

/**
 * Documented deterministic emission factors (all arithmetic performed in code, never by LLM).
 *
 * Sources:
 * - Passenger car tailpipe CO2 & fuel economy: US EPA GHG Equivalencies / UK DESNZ 2024
 *   average petrol passenger car (~0.171 kg CO2/km, ~0.075 L/km ≈ 13.3 km/L).
 * - Urban public bus / metro per passenger-km: UK DESNZ 2024 / IEA (~0.068 kg CO2/pkm avg).
 * - Electricity grid intensity:
 *   - India: CEA CO2 Baseline Database v19 (2023-24 weighted avg 0.727 kg CO2/kWh)
 *   - Global: IEA 2023 global average (0.436 kg CO2/kWh)
 *   - US: EPA eGRID 2022 national average (0.373 kg CO2/kWh)
 *   - EU: EEA 2023 average (0.242 kg CO2/kWh)
 */
export const EMISSION_FACTORS = {
  carKgCo2PerKm: 0.171,
  carLitersPerKm: 0.075,
  publicTransitKgCo2PerPkm: 0.068,
  gridKgCo2PerKwh: {
    india: 0.727,
    global: 0.436,
    us: 0.373,
    eu: 0.242,
  } as Record<HouseholdProfile['regionGrid'], number>,
  gridSources: {
    india: 'Central Electricity Authority (CEA) India CO2 Baseline Database v19 (0.727 kg CO2/kWh)',
    global: 'IEA Global Electricity Emission Factor 2023 (0.436 kg CO2/kWh)',
    us: 'US EPA eGRID National Average (0.373 kg CO2/kWh)',
    eu: 'European Environment Agency (EEA) 2023 Grid Average (0.242 kg CO2/kWh)',
  } as Record<HouseholdProfile['regionGrid'], string>,
} as const;

export interface ImpactCalculationInput {
  type: ImpactActionType;
  distanceKm?: number;
  passengersShared?: number;
  tripsConsolidated?: number;
  kwhSaved?: number;
  daysPerWeek?: number;
  regionGrid?: HouseholdProfile['regionGrid'];
}

const LOCAL_POLLUTANT_DISCLAIMER =
  'CO2 is a long-lived greenhouse gas and is distinct from local air pollutants like PM2.5 and NOx. Individual emission savings reduce tailpipe or power-plant pollution incrementally, but cannot be converted into a specific local AQI point reduction.';

export function calculateEnvironmentalImpact(
  input: ImpactCalculationInput,
): ImpactCalculationResult {
  const regionGrid = input.regionGrid ?? 'india';
  const days = Math.max(1, Math.min(7, Math.round(input.daysPerWeek ?? 1)));

  switch (input.type) {
    case 'carpool': {
      const distance = Math.max(0.5, input.distanceKm ?? 15);
      const passengers = Math.max(2, Math.min(6, Math.round(input.passengersShared ?? 2)));
      const totalKm = distance * days;
      // Baseline: each passenger drives solo. After: shared into 1 car (per-person share = 1/passengers).
      const beforeCo2 = Number((totalKm * EMISSION_FACTORS.carKgCo2PerKm).toFixed(2));
      const afterCo2 = Number(((totalKm * EMISSION_FACTORS.carKgCo2PerKm) / passengers).toFixed(2));
      const avoidedCo2 = Number((beforeCo2 - afterCo2).toFixed(2));
      const fuelSaved = Number(
        (totalKm * EMISSION_FACTORS.carLitersPerKm * (1 - 1 / passengers)).toFixed(2),
      );
      const tripsReduced = Math.round(days * (1 - 1 / passengers) * 2) / 2;

      return {
        actionType: 'carpool',
        quantifiable: true,
        co2AvoidedKg: avoidedCo2,
        fuelSavedLiters: fuelSaved,
        tripsReduced: Math.max(1, Math.round(tripsReduced)),
        kwhSaved: null,
        beforeScenario: `Driving solo ${distance} km/day for ${days} day(s)`,
        afterScenario: `Carpooling with ${passengers} people (${distance} km/day for ${days} day(s))`,
        beforeCo2Kg: beforeCo2,
        afterCo2Kg: afterCo2,
        units: 'kg CO2e, liters fuel',
        assumptions: [
          `Average petrol passenger car factor: ${EMISSION_FACTORS.carKgCo2PerKm} kg CO2/km`,
          `Average fuel consumption: ${EMISSION_FACTORS.carLitersPerKm} L/km (~13.3 km/L)`,
          `Assumes no major detour distance added to pick up passengers`,
        ],
        emissionFactorLabel: `${EMISSION_FACTORS.carKgCo2PerKm} kg CO2/km (solo baseline)`,
        dataSource: 'UK DESNZ 2024 / US EPA Passenger Vehicle Factors',
        uncertainty: '±25% depending on vehicle age, fuel type, traffic congestion, and detour length.',
        localPollutantDistinction: LOCAL_POLLUTANT_DISCLAIMER,
      };
    }

    case 'combine_errands': {
      const distancePerAvoidedTrip = Math.max(0.5, input.distanceKm ?? 6);
      const tripsAvoided = Math.max(1, Math.round(input.tripsConsolidated ?? 2));
      const avoidedKm = distancePerAvoidedTrip * tripsAvoided;
      const beforeCo2 = Number(((avoidedKm + distancePerAvoidedTrip) * EMISSION_FACTORS.carKgCo2PerKm).toFixed(2));
      const afterCo2 = Number((distancePerAvoidedTrip * EMISSION_FACTORS.carKgCo2PerKm).toFixed(2));
      const avoidedCo2 = Number((avoidedKm * EMISSION_FACTORS.carKgCo2PerKm).toFixed(2));
      const fuelSaved = Number((avoidedKm * EMISSION_FACTORS.carLitersPerKm).toFixed(2));

      return {
        actionType: 'combine_errands',
        quantifiable: true,
        co2AvoidedKg: avoidedCo2,
        fuelSavedLiters: fuelSaved,
        tripsReduced: tripsAvoided,
        kwhSaved: null,
        beforeScenario: `${tripsAvoided + 1} separate car errands (~${distancePerAvoidedTrip} km each)`,
        afterScenario: `1 consolidated errand loop avoiding ${tripsAvoided} separate trip(s)`,
        beforeCo2Kg: beforeCo2,
        afterCo2Kg: afterCo2,
        units: 'kg CO2e, liters fuel, trips reduced',
        assumptions: [
          `Each avoided round-trip averages ${distancePerAvoidedTrip} km`,
          `Cold-start tailpipe emissions (higher PM/NOx on short trips) are additionally avoided`,
        ],
        emissionFactorLabel: `${EMISSION_FACTORS.carKgCo2PerKm} kg CO2/km`,
        dataSource: 'UK DESNZ 2024 / US EPA Passenger Vehicle Factors',
        uncertainty: '±20% depending on route geometry and local traffic.',
        localPollutantDistinction: LOCAL_POLLUTANT_DISCLAIMER,
      };
    }

    case 'public_transit': {
      const distance = Math.max(0.5, input.distanceKm ?? 12);
      const totalKm = distance * days;
      const beforeCo2 = Number((totalKm * EMISSION_FACTORS.carKgCo2PerKm).toFixed(2));
      const afterCo2 = Number((totalKm * EMISSION_FACTORS.publicTransitKgCo2PerPkm).toFixed(2));
      const avoidedCo2 = Number(Math.max(0, beforeCo2 - afterCo2).toFixed(2));
      const fuelSaved = Number((totalKm * EMISSION_FACTORS.carLitersPerKm).toFixed(2));

      return {
        actionType: 'public_transit',
        quantifiable: true,
        co2AvoidedKg: avoidedCo2,
        fuelSavedLiters: fuelSaved,
        tripsReduced: days,
        kwhSaved: null,
        beforeScenario: `Driving solo ${distance} km/day for ${days} day(s)`,
        afterScenario: `Metro/bus transit ${distance} km/day for ${days} day(s)`,
        beforeCo2Kg: beforeCo2,
        afterCo2Kg: afterCo2,
        units: 'kg CO2e, liters personal fuel saved',
        assumptions: [
          `Solo petrol car baseline: ${EMISSION_FACTORS.carKgCo2PerKm} kg CO2/km`,
          `Shared urban bus/metro average: ${EMISSION_FACTORS.publicTransitKgCo2PerPkm} kg CO2/passenger-km`,
        ],
        emissionFactorLabel: `Net delta: ${(EMISSION_FACTORS.carKgCo2PerKm - EMISSION_FACTORS.publicTransitKgCo2PerPkm).toFixed(3)} kg CO2/km`,
        dataSource: 'IEA / UK DESNZ 2024 Transit Benchmarks',
        uncertainty: '±30% depending on bus/metro occupancy and whether transit is electric or diesel.',
        localPollutantDistinction: LOCAL_POLLUTANT_DISCLAIMER,
      };
    }

    case 'electricity_reduction': {
      const kwh = Math.max(1, input.kwhSaved ?? 15);
      const gridFactor = EMISSION_FACTORS.gridKgCo2PerKwh[regionGrid];
      const avoidedCo2 = Number((kwh * gridFactor).toFixed(2));

      return {
        actionType: 'electricity_reduction',
        quantifiable: true,
        co2AvoidedKg: avoidedCo2,
        fuelSavedLiters: null,
        tripsReduced: 0,
        kwhSaved: Number(kwh.toFixed(1)),
        beforeScenario: `Baseline household electricity usage (+${kwh} kWh)`,
        afterScenario: `Reduced usage by ${kwh} kWh (LEDs, optimal AC setpoint, standby off)`,
        beforeCo2Kg: avoidedCo2,
        afterCo2Kg: 0,
        units: 'kg CO2e, kWh saved',
        assumptions: [
          `Regional grid intensity (${regionGrid.toUpperCase()}): ${gridFactor} kg CO2/kWh`,
          `Applies average grid mix rather than marginal hourly generation`,
        ],
        emissionFactorLabel: `${gridFactor} kg CO2/kWh`,
        dataSource: EMISSION_FACTORS.gridSources[regionGrid],
        uncertainty: '±15–25% depending on time-of-day renewable share on your local grid.',
        localPollutantDistinction:
          'Lower thermal power demand reduces CO2 and power-plant SO2/NOx/particulate emissions over time, though regional wind and weather determine local neighborhood AQI.',
      };
    }

    case 'avoid_waste_burning': {
      return {
        actionType: 'avoid_waste_burning',
        quantifiable: false,
        co2AvoidedKg: null,
        fuelSavedLiters: null,
        tripsReduced: 0,
        kwhSaved: null,
        beforeScenario: 'Open burning of leaves, garden debris, or mixed household waste',
        afterScenario: 'Composting organic waste and using municipal waste collection/recycling',
        beforeCo2Kg: null,
        afterCo2Kg: null,
        units: 'Qualitative / Educational (no fabricated numeric factor)',
        assumptions: [
          'Open waste composition, moisture content, and combustion efficiency vary widely.',
        ],
        emissionFactorLabel: 'Not assigned a single point factor due to high material variability',
        dataSource: 'WHO / UNEP Open Waste Burning Guidance',
        uncertainty:
          'Exact mass of PM2.5, black carbon, and dioxins avoided cannot be measured accurately without weighing waste composition.',
        localPollutantDistinction:
          'Avoiding open waste burning directly prevents acute localized spikes of PM2.5, carbon monoxide, and toxic smoke around nearby homes, even though a single numeric CO2 figure is not fabricated here.',
        educationalNote:
          'Because household waste varies greatly in weight and composition, BreatheWise AI provides this evidence-based explanation rather than inventing an unsupported CO2 number.',
      };
    }

    case 'cleaner_cooking': {
      return {
        actionType: 'cleaner_cooking',
        quantifiable: false,
        co2AvoidedKg: null,
        fuelSavedLiters: null,
        tripsReduced: 0,
        kwhSaved: null,
        beforeScenario: 'Unvented biomass, charcoal, or smoky solid-fuel cooking indoors',
        afterScenario: 'LPG, piped gas, or electric induction cooking with kitchen exhaust ventilation',
        beforeCo2Kg: null,
        afterCo2Kg: null,
        units: 'Qualitative indoor exposure & emission guidance',
        assumptions: [
          'Fuel mass, stove efficiency, and electricity source vary significantly by household.',
        ],
        emissionFactorLabel: 'WHO Indoor Air Quality Guidelines (household fuel transition)',
        dataSource: 'World Health Organization (WHO) Household Air Pollution Guidelines',
        uncertainty:
          'Exact emission savings depend on cooking duration, stove type, and baseline fuel.',
        localPollutantDistinction:
          'Transitioning away from solid-fuel indoor combustion substantially reduces indoor PM2.5 and CO exposure inside the home, which is distinct from regional outdoor CO2 accounting.',
        educationalNote:
          'Reliable per-meal emission numbers require metered fuel data; therefore we report qualitative indoor-health and emission guidance instead of fabricated savings.',
      };
    }
  }
}
