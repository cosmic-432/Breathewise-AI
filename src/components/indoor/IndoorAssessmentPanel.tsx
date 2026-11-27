import { AlertTriangle } from 'lucide-react';
import type { StructuredAIResponse } from '../../types/index.ts';
import type { evaluateIndoorAir } from '../../utils/indoorAdvisor.ts';
import { StructuredAIResponseCard } from '../StructuredAIResponseCard.tsx';

type IndoorAssessment = ReturnType<typeof evaluateIndoorAir>;

interface IndoorAssessmentPanelProps {
  baseline: IndoorAssessment;
  aiAdvice: StructuredAIResponse | null;
  aiError: string | null;
}

export function IndoorAssessmentPanel({
  baseline,
  aiAdvice,
  aiError,
}: IndoorAssessmentPanelProps) {
  return (
    <div className="lg:col-span-7 space-y-5">
      {/* 1. Measured Indoor Data */}
      <section
        aria-labelledby="measured-indoor-heading"
        className="rounded-xl border border-[#E1EAE4] bg-white p-5 space-y-2"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2
            id="measured-indoor-heading"
            className="text-sm font-semibold text-[#20332B]"
          >
            1. Measured Indoor Air Quality
          </h2>
          <span className="text-xs text-[#66786E]">
            {baseline.measuredSection.hasSensorData
              ? 'User sensor reading'
              : 'No sensor connected'}
          </span>
        </div>
        <p className="text-sm text-[#20332B]/90 leading-relaxed">
          {baseline.measuredSection.summary}
        </p>
      </section>

      {/* 2. Reported Conditions & Ventilation Strategy */}
      <section
        aria-labelledby="reported-indoor-heading"
        className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-5"
      >
        <div>
          <h2
            id="reported-indoor-heading"
            className="text-sm font-semibold text-[#20332B]"
          >
            2. User-Reported Conditions &amp; Baseline Guidance
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#66786E]">
            {baseline.reportedConditionsSummary.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>

        {baseline.ozoneWarning && (
          <div
            role="alert"
            className="rounded-lg border border-[#C94D53]/40 bg-[#FBECEE] p-4 flex items-start gap-3 text-sm text-[#962D32]"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Avoid ozone-generating air cleaners</p>
              <p className="mt-0.5 text-xs leading-relaxed">
                Ozone irritates lungs and can worsen respiratory symptoms. Switch to a
                mechanical True HEPA purifier that does not generate ozone.
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-[#E1EAE4] pt-4 space-y-1.5">
          <h3 className="text-xs font-semibold text-[#18543F]">
            Ventilation Strategy (Outdoor AQI-Aware)
          </h3>
          <p className="text-sm text-[#20332B] leading-relaxed">
            {baseline.ventilationStrategy}
          </p>
        </div>

        <div className="border-t border-[#E1EAE4] pt-4 space-y-3">
          <h3 className="text-xs font-semibold text-[#18543F]">
            Priority Indoor Actions
          </h3>
          <ul className="space-y-3">
            {baseline.priorityActions.map((act) => (
              <li key={act.title} className="space-y-0.5">
                <p className="text-sm font-semibold text-[#20332B]">{act.title}</p>
                <p className="text-sm text-[#66786E] leading-relaxed">{act.detail}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-[#E1EAE4] pt-4 space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold text-[#18543F]">
              General Air Purifier Sizing Guidance
            </h3>
            <span className="text-xs font-mono tabular-nums font-semibold text-[#237A57]">
              Target CADR ≈ {baseline.recommendedCadrM3h} m³/h
            </span>
          </div>
          <p className="text-sm text-[#66786E] leading-relaxed">
            {baseline.purifierGuidance}
          </p>
        </div>
      </section>

      {/* 3. AI-Generated Recommendations */}
      <section
        aria-labelledby="ai-indoor-heading"
        className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-3"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="ai-indoor-heading" className="text-sm font-semibold text-[#20332B]">
            3. AI-Generated Personalized Indoor Guidance
          </h2>
          <span className="text-xs text-[#66786E]">Powered by Gemini</span>
        </div>

        {aiError && (
          <div
            role="alert"
            className="rounded-lg border border-[#C94D53]/40 bg-[#FBECEE] px-4 py-3 text-xs text-[#962D32]"
          >
            {aiError}
          </div>
        )}

        {aiAdvice ? (
          <StructuredAIResponseCard response={aiAdvice} />
        ) : (
          <p className="text-sm text-[#66786E]">
            Click &ldquo;Get AI Indoor Plan&rdquo; above to receive a tailored
            room-by-room indoor air checklist combining your reported room details with
            today’s outdoor air quality.
          </p>
        )}
      </section>
    </div>
  );
}
