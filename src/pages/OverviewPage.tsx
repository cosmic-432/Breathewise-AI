import { ArrowRight, MapPin, RefreshCw } from 'lucide-react';
import { CurrentAqiHeroCard } from '../components/overview/CurrentAqiHeroCard.tsx';
import { ForecastOutlookCard } from '../components/overview/ForecastOutlookCard.tsx';
import { PollutantGrid } from '../components/overview/PollutantGrid.tsx';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import type { NavSection } from '../types/index.ts';

interface OverviewPageProps {
  state: BreatheWiseState;
  onNavigate: (section: NavSection) => void;
  onOpenLocationModal: () => void;
}

interface WorkflowLinkCard {
  title: string;
  description: string;
  cta: string;
  target: NavSection;
}

const WORKFLOW_CARDS: readonly WorkflowLinkCard[] = [
  {
    title: 'Adapt Your Daily Routine',
    description:
      'Check commute, workout, and errand timing against today’s local AQI and household profile.',
    cta: 'Open Daily Planner',
    target: 'planner',
  },
  {
    title: 'Protect Your Indoor Air',
    description:
      'Get ventilation timing, CADR purifier sizing, and combustion-source reduction steps.',
    cta: 'Open Indoor Advisor',
    target: 'indoor',
  },
  {
    title: 'Measure Everyday Impact',
    description:
      'Calculate verified CO2, fuel, and trip savings using transparent deterministic emission factors.',
    cta: 'Open Impact Calculator',
    target: 'impact',
  },
];

export function OverviewPage({
  state,
  onNavigate,
  onOpenLocationModal,
}: OverviewPageProps) {
  const { snapshot, loadingAqi, aqiError, refreshAirQuality, location, household } =
    state;
  const useImperial = household.preferredUnitSystem === 'imperial';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#20332B]">
            Air Quality Overview
          </h1>
          <p className="text-sm text-[#66786E] mt-1">
            Verified local air conditions, pollutant readings, and actionable protection
            steps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenLocationModal}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E1EAE4] bg-white px-4 py-2 text-sm font-medium text-[#20332B] hover:bg-[#F5F8F6] transition-colors whitespace-nowrap shrink-0"
          >
            <MapPin className="w-4 h-4 text-[#237A57]" aria-hidden="true" />
            <span>
              {location.name}
              {location.neighborhood ? ` · ${location.neighborhood}` : ''}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void refreshAirQuality()}
            disabled={loadingAqi}
            aria-label="Refresh air quality readings"
            className="inline-flex items-center gap-2 rounded-lg border border-[#E1EAE4] bg-white px-3.5 py-2 text-sm font-medium text-[#18543F] hover:bg-[#DDF1E6]/50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-4 h-4 ${loadingAqi ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {aqiError && (
        <div
          role="alert"
          className="rounded-xl border border-[#C94D53]/40 bg-[#FBECEE] p-4 text-sm text-[#962D32]"
        >
          <p className="font-semibold">Unable to retrieve live air quality</p>
          <p className="mt-1">{aqiError}</p>
        </div>
      )}

      <CurrentAqiHeroCard
        snapshot={snapshot}
        loading={loadingAqi}
        location={location}
        useImperial={useImperial}
        onNavigate={onNavigate}
      />

      <PollutantGrid pollutants={snapshot?.pollutants ?? []} />

      <ForecastOutlookCard
        locationName={location.name}
        hourlyForecast={snapshot?.hourlyForecast ?? []}
      />

      <section
        aria-label="Next recommended tools"
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {WORKFLOW_CARDS.map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-[#E1EAE4] bg-white p-5 flex flex-col justify-between gap-4"
          >
            <div>
              <h3 className="text-base font-semibold text-[#20332B]">{card.title}</h3>
              <p className="text-sm text-[#66786E] mt-1.5 leading-relaxed">
                {card.description}
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => onNavigate(card.target)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#237A57] hover:text-[#18543F] transition-colors"
              >
                <span>{card.cta}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
