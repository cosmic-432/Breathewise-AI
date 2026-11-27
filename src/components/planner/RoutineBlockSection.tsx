import { Pencil, Trash2 } from 'lucide-react';
import type {
  RoutineActivity,
  RoutineRecommendation,
  TimeBlock,
} from '../../types/index.ts';
import { ACTIVITY_LABELS } from './plannerConstants.ts';

interface RoutineBlockSectionProps {
  blockId: TimeBlock;
  blockLabel: string;
  blockHours: string;
  items: RoutineActivity[];
  recommendationsById: Map<string, RoutineRecommendation>;
  onEdit: (activity: RoutineActivity) => void;
  onRemove: (id: string) => void;
}

export function RoutineBlockSection({
  blockId,
  blockLabel,
  blockHours,
  items,
  recommendationsById,
  onEdit,
  onRemove,
}: RoutineBlockSectionProps) {
  return (
    <section
      aria-labelledby={`block-${blockId}`}
      className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
    >
      <div className="flex items-baseline justify-between gap-2 border-b border-[#E1EAE4] pb-3">
        <h2 id={`block-${blockId}`} className="text-base font-semibold text-[#20332B]">
          {blockLabel}
        </h2>
        <span className="text-xs font-mono tabular-nums text-[#66786E]">
          {blockHours} · {items.length} activity(s)
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[#66786E]">
          No activities scheduled for {blockLabel.toLowerCase()}.
        </p>
      ) : (
        <div className="divide-y divide-[#E1EAE4]">
          {items.map((act) => {
            const rec = recommendationsById.get(act.id);
            if (!rec) return null;
            return (
              <div key={act.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#20332B]">
                      {act.title}
                    </h3>
                    <p className="text-xs text-[#66786E] mt-0.5">
                      {ACTIVITY_LABELS[act.category]} ·{' '}
                      <span className="font-mono tabular-nums">
                        {act.durationMinutes} min
                      </span>{' '}
                      · Exposure risk:{' '}
                      <strong className="font-medium text-[#20332B] capitalize">
                        {rec.exposureLevel}
                      </strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onEdit(act)}
                      aria-label={`Edit ${act.title}`}
                      className="inline-flex items-center gap-1 text-xs text-[#66786E] hover:text-[#18543F] transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(act.id)}
                      aria-label={`Remove ${act.title}`}
                      className="inline-flex items-center gap-1 text-xs text-[#66786E] hover:text-[#C94D53] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-[#F5F8F6] border border-[#E1EAE4] px-4 py-3 text-sm text-[#20332B]">
                  <span className="font-semibold">Recommended timing: </span>
                  {rec.recommendedTiming}
                </div>

                {rec.healthOverEmissionsNote && (
                  <div className="rounded-lg bg-[#FCF3E6] border border-[#D68A35]/30 px-4 py-3 text-xs text-[#8F5818]">
                    <strong className="font-semibold">Health priority: </strong>
                    {rec.healthOverEmissionsNote}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <h4 className="text-xs font-semibold text-[#66786E] mb-1.5">
                      Lower-Exposure Alternatives
                    </h4>
                    <ul className="list-disc pl-4 space-y-1 text-[#20332B]/90">
                      {rec.lowerExposureAlternatives.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-[#66786E] mb-1.5">
                      Sustainable Transport Options
                    </h4>
                    {rec.sustainableTransportOptions.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-[#20332B]/90">
                        {rec.sustainableTransportOptions.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[#66786E]">
                        Focus on exposure reduction for this activity today.
                      </p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-[#66786E] mb-1.5">
                      Practical Actions
                    </h4>
                    <ul className="list-disc pl-4 space-y-1 text-[#20332B]/90">
                      {rec.practicalActions.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <p className="text-xs text-[#66786E]">
                  <span className="font-medium text-[#20332B]">Why: </span>
                  {rec.reasoning}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
