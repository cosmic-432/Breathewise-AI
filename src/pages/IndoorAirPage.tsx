import { useMemo, useState } from 'react';
import { apiClient } from '../api/client.ts';
import { IndoorAssessmentPanel } from '../components/indoor/IndoorAssessmentPanel.tsx';
import { IndoorConditionsForm } from '../components/indoor/IndoorConditionsForm.tsx';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import type { StructuredAIResponse } from '../types/index.ts';
import { evaluateIndoorAir } from '../utils/indoorAdvisor.ts';

interface IndoorAirPageProps {
  state: BreatheWiseState;
}

export function IndoorAirPage({ state }: IndoorAirPageProps) {
  const { indoor, setIndoor, snapshot, household } = state;
  const [aiAdvice, setAiAdvice] = useState<StructuredAIResponse | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const baseline = useMemo(() => evaluateIndoorAir(indoor, snapshot), [indoor, snapshot]);

  const handleRequestAiIndoorAdvice = async () => {
    setLoadingAi(true);
    setAiError(null);
    try {
      const response = await apiClient.askAssistant({
        question:
          'Give practical indoor air quality recommendations for my room conditions and current outdoor AQI, including ventilation timing, cooking exhaust, dust control, and air purifier sizing without inventing any indoor sensor measurements.',
        mode: 'indoor',
        snapshot,
        household,
        indoor,
      });
      setAiAdvice(response);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Unable to generate AI indoor guidance.',
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
            Indoor Air Quality Advisor
          </h1>
          <p className="text-sm text-[#66786E] mt-1">
            Ventilation timing, source control, and purifier sizing separated cleanly into
            measured data, reported room conditions, and AI guidance.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRequestAiIndoorAdvice()}
          disabled={loadingAi}
          className="inline-flex items-center justify-center rounded-lg bg-[#237A57] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18543F] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          {loadingAi ? 'Generating AI Guidance...' : 'Get AI Indoor Plan'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <IndoorConditionsForm indoor={indoor} onChange={setIndoor} />
        <IndoorAssessmentPanel
          baseline={baseline}
          aiAdvice={aiAdvice}
          aiError={aiError}
        />
      </div>
    </div>
  );
}
