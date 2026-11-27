import type { StructuredAIResponse } from '../types/index.ts';
import { StructuredAIResponseCard } from './StructuredAIResponseCard.tsx';

interface AiGuidanceCardProps {
  title: string;
  response: StructuredAIResponse | null;
  error: string | null;
  onDismiss: () => void;
  ariaLabel?: string;
}

export function AiGuidanceCard({
  title,
  response,
  error,
  onDismiss,
  ariaLabel,
}: AiGuidanceCardProps) {
  return (
    <>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#C94D53]/40 bg-[#FBECEE] p-4 text-sm text-[#962D32]"
        >
          {error}
        </div>
      )}

      {response && (
        <section
          aria-label={ariaLabel}
          className="rounded-xl border border-[#237A57]/40 bg-white p-6 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[#18543F]">{title}</h2>
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-[#52645A] hover:text-[#20332B]"
            >
              Dismiss
            </button>
          </div>
          <StructuredAIResponseCard response={response} />
        </section>
      )}
    </>
  );
}
