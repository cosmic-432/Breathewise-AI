import type { SustainableAlternativeItem } from '../types/index.ts';

export const SUSTAINABLE_ALTERNATIVES_CATALOG: SustainableAlternativeItem[] = [
  {
    id: 'trans-public-transit',
    category: 'transportation',
    title: 'Enclosed Metro or Bus Transit for Daily Commutes',
    currentHabit:
      'Driving a single-occupancy petrol or diesel car to college or work daily.',
    suggestedAlternative:
      'Use enclosed metro rail or air-conditioned public buses for trunk commute segments.',
    whyItMatters:
      'Replaces individual tailpipe emissions per kilometer traveled and eases urban traffic congestion that traps vehicle exhaust at street level.',
    practicalImplementation: [
      'Check off-peak departure times to reduce crowded platform waits.',
      'Pair metro rides with shared feeder autos or e-rickshaws for the last mile.',
      'Keep a travel card topped up to remove daily friction.',
    ],
    potentialBenefit:
      'Roughly 55–65% lower CO2 per passenger-kilometer compared with a solo petrol car, plus reduced personal exposure when riding enclosed transit during smog episodes.',
    tradeOffsAndLimitations:
      'Requires route coverage and slightly longer door-to-door time; individual transit shifts help reduce local traffic emissions incrementally but do not solve regional smog alone.',
  },
  {
    id: 'trans-carpool',
    category: 'transportation',
    title: 'Neighborhood or Workplace Carpooling',
    currentHabit:
      'Multiple colleagues or classmates driving separate vehicles along the same corridor.',
    suggestedAlternative:
      'Coordinate a 2–4 person rotating carpool with cabin air set to recirculate during hazy commutes.',
    whyItMatters:
      'Cuts total vehicles on congested roads during peak inversion hours and divides per-person fuel use immediately.',
    practicalImplementation: [
      'Set a fixed pickup point along the main route to avoid extra detour kilometers.',
      'Rotate driving weeks or split fuel costs transparently.',
    ],
    potentialBenefit:
      'Reduces per-person commute fuel and tailpipe CO2 by ~50% (2 riders) to ~67% (3 riders) when detours are minimal.',
    tradeOffsAndLimitations:
      'Less flexible for unexpected schedule changes; requires clear backup plans.',
  },
  {
    id: 'trans-trip-consolidation',
    category: 'transportation',
    title: 'Trip Consolidation for Errands and Groceries',
    currentHabit:
      'Making multiple short solo car or two-wheeler trips throughout the week.',
    suggestedAlternative:
      'Batch grocery, pharmacy, and neighborhood errands into one planned loop.',
    whyItMatters:
      'Short cold-start trips produce disproportionately higher tailpipe CO, hydrocarbons, and particulate emissions before catalytic converters warm up.',
    practicalImplementation: [
      'Keep a shared family shopping list on the fridge or phone.',
      'Combine errands with an existing commute rather than making a separate evening trip.',
    ],
    potentialBenefit:
      'Avoids 2–4 cold-start trips per week, lowering both personal outdoor smog exposure and fuel costs.',
    tradeOffsAndLimitations: 'Requires planning ahead for perishables and storage space.',
  },
  {
    id: 'trans-walk-cycle-clean-air',
    category: 'transportation',
    title: 'Walking or Cycling on Clean-Air Days',
    currentHabit:
      'Using motor vehicles for short 1–3 km neighborhood trips even when outdoor air is clean.',
    suggestedAlternative:
      'Walk or cycle along quiet side streets strictly when AQI is Good or Moderate and road conditions are safe.',
    whyItMatters:
      'Zero tailpipe emissions for short local trips while supporting cardiovascular fitness when ambient air is clean.',
    practicalImplementation: [
      'Always check BreatheWise AQI before heading out.',
      'Pick residential lanes away from heavy diesel bus/truck routes.',
    ],
    potentialBenefit:
      'Eliminates 100% of vehicle tailpipe emissions for short errands without increasing lung exposure when air is clean.',
    tradeOffsAndLimitations:
      'Do NOT walk vigorously or cycle during Poor, Very Poor, or Severe pollution—respiratory protection outweighs emission savings during smog episodes.',
    requiresSafeOutdoorAir: true,
  },
  {
    id: 'house-cleaner-cooking',
    category: 'household',
    title: 'Electric Induction or Vented LPG Cooking',
    currentHabit:
      'Cooking on solid fuels (wood, coal, biomass) or using unvented burners without exhaust.',
    suggestedAlternative:
      'Use electric induction or LPG with an externally vented chimney/exhaust fan running during and after cooking.',
    whyItMatters:
      'Household solid-fuel combustion is a leading contributor to both severe indoor PM2.5 exposure and neighborhood smoke.',
    practicalImplementation: [
      'Turn on the exhaust fan before heating cooking oil.',
      'Use pressure cookers and lids to shorten cooking times and reduce kitchen heat and fumes.',
    ],
    potentialBenefit:
      'Dramatically reduces indoor fine particulates and carbon monoxide inside the living space.',
    tradeOffsAndLimitations:
      'Requires upfront cookware/appliance cost and reliable electricity or LPG supply.',
  },
  {
    id: 'house-energy-efficiency',
    category: 'household',
    title: 'Trimming Peak Household Electricity Demand',
    currentHabit:
      'Running older cooling/heating units at extreme temperatures and leaving appliances on standby.',
    suggestedAlternative:
      'Set AC to 24–26°C with ceiling fans, switch to LEDs, clean AC filters monthly, and unplug idle chargers.',
    whyItMatters:
      'In coal-heavy grids, lower electricity demand reduces upstream power-plant CO2, SO2, NOx, and particulate emissions.',
    practicalImplementation: [
      'Use smart strips or wall switches for entertainment and home-office setups.',
      'Shade sun-facing windows in summer to cut cooling load.',
    ],
    potentialBenefit:
      'Typical households can cut electricity usage by 10–20%, saving both bills and measurable grid CO2.',
    tradeOffsAndLimitations:
      'Never compromise safe indoor air purification or safe indoor thermal comfort for elderly or vulnerable family members just to save a few watt-hours.',
  },
  {
    id: 'house-no-waste-burning',
    category: 'household',
    title: 'Zero Open Waste or Leaf Burning',
    currentHabit:
      'Burning dry garden leaves, cardboard, or household trash outdoors in winter evenings.',
    suggestedAlternative:
      'Compost dry leaves/organics and hand segregated dry waste to municipal collection or recyclers.',
    whyItMatters:
      'Open burning happens at low temperature and emits dense clouds of PM2.5, black carbon, and toxic smoke right at breathing height.',
    practicalImplementation: [
      'Use a simple backyard compost bin or leaf-mulch bag for garden waste.',
      'Report repeated municipal garbage burning through official civic helplines.',
    ],
    potentialBenefit:
      'Immediately prevents localized toxic smoke plumes affecting your family and immediate neighbors.',
    tradeOffsAndLimitations:
      'Depends on reliable local waste collection; requires space or community composting coordination.',
  },
  {
    id: 'comm-shared-school-pool',
    category: 'community',
    title: 'School & Resident Association Clean-Air Carpools',
    currentHabit:
      'Long lines of idling private vehicles outside school gates every morning and afternoon.',
    suggestedAlternative:
      'Organize no-idling school gate pledges and neighborhood bus/carpool groups through parent associations.',
    whyItMatters:
      'Idling exhaust peaks directly where children breathe while waiting at school gates.',
    practicalImplementation: [
      'Share an opt-in corridor sheet (general area only, no home addresses published publicly).',
      'Ask school administration to display "Turn Off Engines While Waiting" signage.',
    ],
    potentialBenefit:
      'Lowers peak localized exhaust concentrations around school drop-off zones.',
    tradeOffsAndLimitations:
      'Requires school and parent coordination to sustain consistently.',
  },
  {
    id: 'comm-urban-trees',
    category: 'community',
    title: 'Native Tree Protection & Dusty-Patch Mulching',
    currentHabit:
      'Bare roadside soil patches generating windblown PM10 dust and neglected urban saplings.',
    suggestedAlternative:
      'Participate in resident-led native tree maintenance and green-cover stabilization of bare dusty verges.',
    whyItMatters:
      'Stabilizing bare soil reduces resuspended coarse road dust (PM10) and improves neighborhood shade and microclimate.',
    practicalImplementation: [
      'Coordinate with municipal horticulture departments before planting near utilities.',
      'Focus on watering and protecting existing saplings rather than one-off photo-op plantings.',
    ],
    potentialBenefit:
      'Long-term dust stabilization and shade cooling over years of growth.',
    tradeOffsAndLimitations:
      'Urban trees help stabilize dust and shade streets, but cannot filter out severe regional smog or replace emissions policy and clean transport.',
  },
];
