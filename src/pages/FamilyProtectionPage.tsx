import { useState } from 'react';
import { apiClient } from '../api/client.ts';
import { AiGuidanceCard } from '../components/AiGuidanceCard.tsx';
import { FamilyChecklistSection } from '../components/family/FamilyChecklistSection.tsx';
import { HouseholdProfileForm } from '../components/family/HouseholdProfileForm.tsx';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import type { StructuredAIResponse } from '../types/index.ts';
import { interpretAqi } from '../utils/aqi.ts';

interface FamilyProtectionPageProps {
  state: BreatheWiseState;
}

export function FamilyProtectionPage({ state }: FamilyProtectionPageProps) {
  const { household, setHousehold, checklist, setChecklist, snapshot } = state;
  const [aiBrief, setAiBrief] = useState<StructuredAIResponse | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const aqiInfo = interpretAqi(snapshot?.aqi, snapshot?.aqiScale ?? 'US_EPA');
  const isPolluted = !aqiInfo.outdoorExerciseSafe;

  const handleAskFamilyBrief = async () => {
    setLoadingAi(true);
    setAiError(null);
    try {
      const response = await apiClient.askAssistant({
        question:
          'Generate a practical, non-diagnostic family air-quality protection plan for today tailored to our household age groups, commute patterns, and selected sensitivity considerations.',
        mode: 'family',
        snapshot,
        household,
      });
      setAiBrief(response);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Unable to generate family guidance.',
      );
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#20332B]">
            Family Protection Mode
          </h1>
          <p className="text-sm text-[#66786E] mt-1">
            Practical household exposure-reduction planning for children, older adults,
            sensitive members, and outdoor workers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleAskFamilyBrief()}
          disabled={loadingAi}
          className="inline-flex items-center justify-center rounded-lg bg-[#237A57] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18543F] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          {loadingAi ? 'Generating Family Brief...' : 'Generate AI Family Brief'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <HouseholdProfileForm household={household} onChange={setHousehold} />

        {/* Right: Tailored Group Guidance + Daily Checklist */}
        <div className="lg:col-span-7 space-y-5">
          <AiGuidanceCard
            title="Gemini Family Protection Brief"
            response={aiBrief}
            error={aiError}
            onDismiss={() => setAiBrief(null)}
          />

          {/* Special Consideration Guidance Cards */}
          <section
            aria-labelledby="special-groups-heading"
            className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="special-groups-heading"
                className="text-base font-semibold text-[#20332B]"
              >
                Tailored Exposure-Reduction Considerations
              </h2>
              <span className="text-xs text-[#66786E]">
                Current AQI: {snapshot?.aqi ?? 'Unavailable'} ({aqiInfo.label})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] p-4 space-y-1.5">
                <h3 className="text-sm font-semibold text-[#20332B]">Children</h3>
                <p className="text-xs text-[#66786E] leading-relaxed">
                  {isPolluted
                    ? 'Developing lungs breathe faster relative to body weight. Shift active sports indoors today, limit roadside waiting at school gates, and ensure indoor play spaces stay smoke-free.'
                    : 'Current air quality allows normal outdoor play; prefer parks set back from congested roads and recheck AQI before evening.'}
                </p>
              </div>

              <div className="rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] p-4 space-y-1.5">
                <h3 className="text-sm font-semibold text-[#20332B]">
                  Older Adults (65+)
                </h3>
                <p className="text-xs text-[#66786E] leading-relaxed">
                  {isPolluted
                    ? 'Avoid early-morning outdoor walks during winter smog inversions. Keep indoor rooms comfortably filtered, have others handle errands, and seek prompt medical advice if shortness of breath or chest discomfort occurs.'
                    : 'Light outdoor walks are reasonable under current readings; carry prescribed medications and check afternoon/evening trends.'}
                </p>
              </div>

              <div className="rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] p-4 space-y-1.5">
                <h3 className="text-sm font-semibold text-[#20332B]">
                  Respiratory &amp; Cardiovascular Sensitivities
                </h3>
                <p className="text-xs text-[#66786E] leading-relaxed">
                  Follow your clinician’s existing action plan and keep prescribed
                  reliever medications accessible. Reduce exertion during elevated
                  PM2.5/O3 and seek medical care promptly for worsening symptoms.
                </p>
              </div>

              <div className="rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] p-4 space-y-1.5">
                <h3 className="text-sm font-semibold text-[#20332B]">Outdoor Workers</h3>
                <p className="text-xs text-[#66786E] leading-relaxed">
                  {isPolluted
                    ? 'Use a well-fitted N95/FFP2 respirator during high-particulate shifts, schedule indoor recovery breaks, stay hydrated, and shift heavy manual work away from peak traffic hours where feasible.'
                    : 'Keep particulate protection available if localized dust, road work, or smoke appears on-site.'}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#66786E]">
              Note: BreatheWise AI provides general exposure-reduction education and does
              not diagnose or predict medical conditions.
            </p>
          </section>

          <FamilyChecklistSection checklist={checklist} onChange={setChecklist} />
        </div>
      </div>
    </div>
  );
}
