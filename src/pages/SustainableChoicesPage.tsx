import type { KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { AiGuidanceCard } from '../components/AiGuidanceCard.tsx';
import { useAiGuidance } from '../hooks/useAiGuidance.ts';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import type { NavSection, SustainableAlternativeItem } from '../types/index.ts';
import { interpretAqi } from '../utils/aqi.ts';
import { SUSTAINABLE_ALTERNATIVES_CATALOG } from '../utils/sustainableCatalog.ts';

interface SustainableChoicesPageProps {
  state: BreatheWiseState;
  onNavigate: (section: NavSection) => void;
}

type CategoryFilter = 'all' | SustainableAlternativeItem['category'];

const CATEGORY_TABS: ReadonlyArray<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: 'All Categories' },
  { id: 'transportation', label: 'Transportation' },
  { id: 'household', label: 'Household' },
  { id: 'community', label: 'Community' },
];

export function SustainableChoicesPage({
  state,
  onNavigate,
}: SustainableChoicesPageProps) {
  const { snapshot, household } = state;
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % CATEGORY_TABS.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + CATEGORY_TABS.length) % CATEGORY_TABS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = CATEGORY_TABS.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const targetTab = CATEGORY_TABS[nextIndex];
    if (targetTab) {
      setFilter(targetTab.id);
      tabRefs.current[nextIndex]?.focus();
    }
  };
  const aiIdeas = useAiGuidance();

  const aqiInfo = interpretAqi(snapshot?.aqi, snapshot?.aqiScale ?? 'US_EPA');
  const outdoorUnsafe = !aqiInfo.outdoorExerciseSafe;

  const filtered =
    filter === 'all'
      ? SUSTAINABLE_ALTERNATIVES_CATALOG
      : SUSTAINABLE_ALTERNATIVES_CATALOG.filter((item) => item.category === filter);

  const handleAskAiAlternatives = () =>
    aiIdeas.requestGuidance(
      {
        question:
          'Recommend practical lower-emission transportation, household, and neighborhood choices tailored to my household profile and today’s air quality. Clearly note trade-offs and avoid recommending outdoor cycling or walking if air quality is poor.',
        mode: 'sustainable',
        snapshot,
        household,
      },
      'Unable to generate sustainable recommendations.',
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#20332B]">
            Sustainable Choices
          </h1>
          <p className="text-sm text-[#52645A] mt-1">
            Practical, lower-emission alternatives with transparent trade-offs and
            exposure-safe timing.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleAskAiAlternatives()}
          disabled={aiIdeas.loading}
          className="inline-flex items-center justify-center rounded-lg bg-[#237A57] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18543F] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          {aiIdeas.loading ? 'Personalizing with AI...' : 'Personalize Swaps with Gemini'}
        </button>
      </div>

      {/* Filter Bar + Scope Honesty Notice */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Filter sustainable alternatives by category"
          className="inline-flex items-center gap-1 rounded-lg bg-[#E9F0EC] p-1 self-start"
        >
          {CATEGORY_TABS.map((tab, index) => {
            const isSelected = filter === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                id={`sustainable-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls="sustainable-alternatives-panel"
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setFilter(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-white text-[#18543F] shadow-xs'
                    : 'text-[#52645A] hover:text-[#20332B]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-[#52645A] max-w-md">
          Individual choices reduce personal emissions and local smoke plumes, but
          citywide smog also requires collective action, clean transit, and policy
          measures.
        </p>
      </div>

      <AiGuidanceCard
        title="Gemini Personalized Sustainable Recommendations"
        response={aiIdeas.response}
        error={aiIdeas.error}
        onDismiss={aiIdeas.dismiss}
      />

      {/* Alternatives List */}
      <div
        id="sustainable-alternatives-panel"
        role="tabpanel"
        aria-labelledby={`sustainable-tab-${filter}`}
        tabIndex={0}
        className="space-y-4"
      >
        {filtered.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-[#237A57] capitalize">
                  {item.category}
                </p>
                <h2 className="text-lg font-semibold text-[#20332B] mt-0.5">
                  {item.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('impact')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#237A57] hover:text-[#18543F] whitespace-nowrap"
              >
                <span>Estimate impact</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {item.requiresSafeOutdoorAir && outdoorUnsafe && (
              <div className="rounded-lg border border-[#D68A35]/40 bg-[#FCF3E6] px-4 py-3 flex items-start gap-2.5 text-xs text-[#8F5818]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong>Defer today:</strong> Current air quality ({aqiInfo.label}) is
                  not safe for vigorous outdoor walking or cycling. Choose enclosed public
                  transit or carpooling until AQI improves.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm border-t border-[#E1EAE4] pt-4">
              <div>
                <h3 className="text-xs font-semibold text-[#52645A]">1. Current habit</h3>
                <p className="mt-1 text-[#20332B]">{item.currentHabit}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#18543F]">
                  2. Suggested alternative
                </h3>
                <p className="mt-1 text-[#20332B]">{item.suggestedAlternative}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#52645A]">
                  3. Why it matters
                </h3>
                <p className="mt-1 text-[#20332B]/90 leading-relaxed">
                  {item.whyItMatters}
                </p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#52645A]">
                  4. Practical implementation
                </h3>
                <ul className="mt-1 list-disc pl-4 space-y-1 text-[#20332B]/90">
                  {item.practicalImplementation.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#237A57]">
                  5. Potential environmental benefit
                </h3>
                <p className="mt-1 text-[#20332B]/90 leading-relaxed">
                  {item.potentialBenefit}
                </p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#52645A]">
                  6. Trade-offs &amp; limitations
                </h3>
                <p className="mt-1 text-[#52645A] leading-relaxed">
                  {item.tradeOffsAndLimitations}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
