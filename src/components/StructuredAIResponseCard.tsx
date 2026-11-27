import { memo } from 'react';
import type { StructuredAIResponse } from '../types/index.ts';

interface StructuredAIResponseCardProps {
  response: StructuredAIResponse;
}

export const StructuredAIResponseCard = memo(function StructuredAIResponseCard({
  response,
}: StructuredAIResponseCardProps) {
  const ctx = response.air_quality_context;

  return (
    <div className="space-y-5 text-sm text-[#20332B]">
      <div>
        <p className="leading-relaxed text-[15px] text-[#20332B]">
          {response.summary}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#66786E]">
          <span className="font-medium text-[#20332B]">{ctx.location}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            AQI {ctx.aqi_value !== null ? ctx.aqi_value : 'Unavailable'} ({ctx.aqi_category})
          </span>
          <span aria-hidden="true">·</span>
          <span>{ctx.data_status}</span>
          <span aria-hidden="true">·</span>
          <span>Source: {ctx.data_source}</span>
          <span aria-hidden="true">·</span>
          <span>Updated: {ctx.last_updated}</span>
        </div>
      </div>

      {response.recommendations.length > 0 && (
        <div className="border-t border-[#E1EAE4] pt-4">
          <h4 className="text-xs font-semibold text-[#66786E] mb-3">
            Priority Recommendations
          </h4>
          <ol className="space-y-3">
            {response.recommendations.map((rec, idx) => (
              <li key={`${rec.title}-${idx}`} className="space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-[#20332B]">
                    {idx + 1}. {rec.title}
                  </span>
                  <span className="text-xs text-[#66786E]">
                    {rec.basis === 'verified_data'
                      ? 'Based on retrieved local data'
                      : 'General guidance'}
                  </span>
                </div>
                <p className="text-sm text-[#20332B]/90 leading-relaxed">
                  {rec.action}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(response.indoor_actions.length > 0 || response.outdoor_actions.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-[#E1EAE4] pt-4">
          {response.indoor_actions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#18543F] mb-2">
                Indoor Precautions
              </h4>
              <ul className="space-y-1.5 list-disc pl-4 text-sm text-[#20332B]/90">
                {response.indoor_actions.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {response.outdoor_actions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#18543F] mb-2">
                Outdoor Exposure Reduction
              </h4>
              <ul className="space-y-1.5 list-disc pl-4 text-sm text-[#20332B]/90">
                {response.outdoor_actions.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {(response.sustainable_alternatives.length > 0 ||
        response.impact_explanation.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-[#E1EAE4] pt-4">
          {response.sustainable_alternatives.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#237A57] mb-2">
                Lower-Emission Choices (Where Safe)
              </h4>
              <ul className="space-y-1.5 list-disc pl-4 text-sm text-[#20332B]/90">
                {response.sustainable_alternatives.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {response.impact_explanation.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[#237A57] mb-2">
                Why These Steps Matter
              </h4>
              <ul className="space-y-1.5 list-disc pl-4 text-sm text-[#20332B]/90">
                {response.impact_explanation.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-[#E1EAE4] pt-3.5 text-xs text-[#66786E] space-y-1.5">
        {response.limitations.length > 0 && (
          <div>
            <span className="font-semibold text-[#20332B]">
              Limitations &amp; health notice:{' '}
            </span>
            {response.limitations.join(' ')}
          </div>
        )}
        <div>
          Educational air-quality guidance only — not medical advice. Seek prompt medical attention if anyone experiences breathing difficulty, chest pain, or severe wheezing.
        </div>
        {response.sources.length > 0 && (
          <div>
            <span className="font-semibold text-[#20332B]">Sources referenced: </span>
            {response.sources.join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
});
