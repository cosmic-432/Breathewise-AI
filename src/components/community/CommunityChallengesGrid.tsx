import { Check, Plus, Users } from 'lucide-react';
import type { CommunityChallenge } from '../../types/index.ts';

interface CommunityChallengesGridProps {
  challenges: CommunityChallenge[];
  loading: boolean;
  joinedIds: string[];
  busyId: string | null;
  onParticipate: (challengeId: string, action: 'join' | 'log_action') => void;
}

export function CommunityChallengesGrid({
  challenges,
  loading,
  joinedIds,
  busyId,
  onParticipate,
}: CommunityChallengesGridProps) {
  return (
    <section aria-labelledby="challenges-heading" className="space-y-3">
      <h2 id="challenges-heading" className="text-base font-semibold text-[#20332B]">
        Voluntary Low-Emission Challenges
      </h2>

      {loading ? (
        <p className="text-sm text-[#52645A]">Loading community challenges...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {challenges.map((ch) => {
            const joined = joinedIds.includes(ch.id);
            const isBusy = busyId === ch.id;
            return (
              <article
                key={ch.id}
                className="rounded-xl border border-[#E1EAE4] bg-white p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-[#52645A]">
                    <span className="capitalize font-medium text-[#237A57]">
                      {ch.category}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      {ch.participantsCount} joined · {ch.actionsLoggedCount} logged
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-[#20332B]">{ch.title}</h3>
                  <p className="text-sm text-[#52645A] leading-relaxed">
                    {ch.description}
                  </p>
                  <p className="text-xs text-[#20332B]/80">Goal: {ch.goalDescription}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#E1EAE4]">
                  {!joined ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onParticipate(ch.id, 'join')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#18543F] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#237A57] disabled:opacity-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Join Voluntarily</span>
                    </button>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#237A57]">
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        Joined
                      </span>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onParticipate(ch.id, 'log_action')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-1.5 text-xs font-medium text-[#20332B] hover:border-[#237A57] disabled:opacity-50 transition-colors"
                      >
                        <span>Log Completed Action</span>
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
