import { useEffect, useState } from 'react';
import { Check, Plus, Users } from 'lucide-react';
import { apiClient } from '../api/client.ts';
import { StructuredAIResponseCard } from '../components/StructuredAIResponseCard.tsx';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import { localStore } from '../storage/localStore.ts';
import type {
  CommunityChallenge,
  CommunityReport,
  StructuredAIResponse,
} from '../types/index.ts';
import { formatReadableTimestamp } from '../utils/aqi.ts';
import { isOneOf } from '../utils/typeGuards.ts';

interface CommunityPageProps {
  state: BreatheWiseState;
}

const REPORT_CATEGORIES: readonly CommunityReport['category'][] = [
  'tip',
  'initiative',
  'observation',
];

export function CommunityPage({ state }: CommunityPageProps) {
  const { location, snapshot } = state;
  const [challenges, setChallenges] = useState<CommunityChallenge[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [totalActions, setTotalActions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [joinedIds, setJoinedIds] = useState<string[]>(() =>
    localStore.getJoinedChallenges(),
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  // User report / tip form (general area only — no street addresses)
  const [areaLabel, setAreaLabel] = useState(location.name);
  const [category, setCategory] = useState<CommunityReport['category']>('tip');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  // AI community campaign generator
  const [aiCampaign, setAiCampaign] = useState<StructuredAIResponse | null>(null);
  const [loadingCampaign, setLoadingCampaign] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    apiClient
      .fetchCommunity(controller.signal)
      .then((data) => {
        setChallenges(data.challenges);
        setReports(data.reports);
        setTotalParticipants(data.totalVerifiedParticipants);
        setTotalActions(data.totalLoggedActions);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(
          err instanceof Error ? err.message : 'Unable to load community hub right now.',
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const handleParticipate = async (
    challengeId: string,
    action: 'join' | 'log_action',
  ) => {
    setBusyId(challengeId);
    setError(null);
    try {
      const clientToken = localStore.getOrCreateClientToken();
      const res = await apiClient.participateInChallenge({
        challengeId,
        action,
        clientToken,
      });
      setChallenges(res.summary.challenges);
      setTotalParticipants(res.summary.totalVerifiedParticipants);
      setTotalActions(res.summary.totalLoggedActions);

      if (!joinedIds.includes(challengeId)) {
        const next = [...joinedIds, challengeId];
        setJoinedIds(next);
        localStore.setJoinedChallenges(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record participation.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportFeedback(null);
    setSubmittingReport(true);
    try {
      const res = await apiClient.submitCommunityReport({
        areaLabel: areaLabel.trim(),
        category,
        title: title.trim(),
        description: description.trim(),
      });
      setReports(res.summary.reports);
      setTitle('');
      setDescription('');
      setReportFeedback(
        'Posted to the community feed with an unverified user-submission label.',
      );
    } catch (err) {
      setReportFeedback(
        err instanceof Error ? err.message : 'Unable to submit community post.',
      );
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleGenerateCampaign = async () => {
    setLoadingCampaign(true);
    try {
      const response = await apiClient.askAssistant({
        question: `Suggest a practical, privacy-respecting neighborhood or school clean-air awareness campaign for residents in ${location.name}, focusing on no-idling zones, zero leaf burning, and shared commuting.`,
        mode: 'community',
        snapshot,
      });
      setAiCampaign(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to generate community campaign ideas.',
      );
    } finally {
      setLoadingCampaign(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#20332B]">
            Community Action Hub
          </h1>
          <p className="text-sm text-[#66786E] mt-1">
            Voluntary low-emission challenges, clean-air tips, and neighborhood
            initiatives with genuine participation tracking.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleGenerateCampaign()}
          disabled={loadingCampaign}
          className="inline-flex items-center justify-center rounded-lg bg-[#237A57] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18543F] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          {loadingCampaign ? 'Drafting Campaign Idea...' : 'AI Campaign Idea'}
        </button>
      </div>

      {/* Authentic Recorded Totals (Zero Fabricated Numbers) */}
      <div className="rounded-xl border border-[#E1EAE4] bg-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-[#66786E]">Verified Voluntary Participants</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#18543F]">
              {totalParticipants}
            </p>
          </div>
          <div className="border-l border-[#E1EAE4] pl-6">
            <p className="text-xs text-[#66786E]">Community Actions Logged</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#20332B]">
              {totalActions}
            </p>
          </div>
        </div>
        <p className="text-xs text-[#66786E] max-w-md">
          All counts reflect real recorded actions on this BreatheWise instance — we never
          fabricate participation figures or expose home addresses.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#C94D53]/40 bg-[#FBECEE] p-4 text-sm text-[#962D32]"
        >
          {error}
        </div>
      )}

      {aiCampaign && (
        <section className="rounded-xl border border-[#237A57]/40 bg-white p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[#18543F]">
              Gemini Community Campaign Blueprint
            </h2>
            <button
              type="button"
              onClick={() => setAiCampaign(null)}
              className="text-xs text-[#66786E] hover:text-[#20332B]"
            >
              Dismiss
            </button>
          </div>
          <StructuredAIResponseCard response={aiCampaign} />
        </section>
      )}

      {/* Voluntary Challenges */}
      <section aria-labelledby="challenges-heading" className="space-y-3">
        <h2 id="challenges-heading" className="text-base font-semibold text-[#20332B]">
          Voluntary Low-Emission Challenges
        </h2>

        {loading ? (
          <p className="text-sm text-[#66786E]">Loading community challenges...</p>
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
                    <div className="flex items-center justify-between gap-2 text-xs text-[#66786E]">
                      <span className="capitalize font-medium text-[#237A57]">
                        {ch.category}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <Users className="w-3.5 h-3.5" aria-hidden="true" />
                        {ch.participantsCount} joined · {ch.actionsLoggedCount} logged
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-[#20332B]">{ch.title}</h3>
                    <p className="text-sm text-[#66786E] leading-relaxed">
                      {ch.description}
                    </p>
                    <p className="text-xs text-[#20332B]/80">
                      Goal: {ch.goalDescription}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#E1EAE4]">
                    {!joined ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleParticipate(ch.id, 'join')}
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
                          onClick={() => void handleParticipate(ch.id, 'log_action')}
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

      {/* Community Tips & Local Initiatives */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section
          aria-labelledby="share-tip-heading"
          className="lg:col-span-5 rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
        >
          <div>
            <h2 id="share-tip-heading" className="text-base font-semibold text-[#20332B]">
              Share a Clean-Air Tip or Local Initiative
            </h2>
            <p className="text-xs text-[#66786E] mt-0.5">
              Protect privacy: enter only a general city or district name — never share
              home street addresses or personal contact details.
            </p>
          </div>

          <form onSubmit={handleSubmitReport} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="comm-area"
                  className="block text-xs font-medium text-[#20332B] mb-1"
                >
                  General area / city
                </label>
                <input
                  id="comm-area"
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={areaLabel}
                  onChange={(e) => setAreaLabel(e.target.value)}
                  placeholder="e.g., South Delhi"
                  className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B]"
                />
              </div>
              <div>
                <label
                  htmlFor="comm-cat"
                  className="block text-xs font-medium text-[#20332B] mb-1"
                >
                  Type
                </label>
                <select
                  id="comm-cat"
                  value={category}
                  onChange={(e) => {
                    if (isOneOf(e.target.value, REPORT_CATEGORIES)) {
                      setCategory(e.target.value);
                    }
                  }}
                  className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B]"
                >
                  <option value="tip">Community Tip</option>
                  <option value="initiative">Local Initiative</option>
                  <option value="observation">Air Observation</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="comm-title"
                className="block text-xs font-medium text-[#20332B] mb-1"
              >
                Title
              </label>
              <input
                id="comm-title"
                type="text"
                required
                minLength={4}
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Resident leaf composting drive"
                className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B]"
              />
            </div>

            <div>
              <label
                htmlFor="comm-desc"
                className="block text-xs font-medium text-[#20332B] mb-1"
              >
                Details
              </label>
              <textarea
                id="comm-desc"
                rows={3}
                required
                minLength={10}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Share practical steps or local clean-air observations..."
                className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B]"
              />
            </div>

            <button
              type="submit"
              disabled={submittingReport}
              className="w-full rounded-lg bg-[#18543F] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#237A57] disabled:opacity-50 transition-colors"
            >
              {submittingReport ? 'Publishing...' : 'Post to Community Feed'}
            </button>

            {reportFeedback && <p className="text-xs text-[#237A57]">{reportFeedback}</p>}
          </form>
        </section>

        <section
          aria-labelledby="comm-feed-heading"
          className="lg:col-span-7 rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="comm-feed-heading" className="text-base font-semibold text-[#20332B]">
              Community Tips &amp; Local Reports ({reports.length})
            </h2>
            <span className="text-xs text-[#66786E]">
              User-submitted items are clearly marked unverified
            </span>
          </div>

          {reports.length === 0 ? (
            <p className="text-sm text-[#66786E] py-4">
              No community posts yet. Share the first clean-air tip or neighborhood
              initiative from the form on the left.
            </p>
          ) : (
            <ul className="divide-y divide-[#E1EAE4]">
              {reports.map((rep) => (
                <li key={rep.id} className="py-4 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#66786E]">
                    <span className="font-medium text-[#20332B]">{rep.areaLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{rep.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>Unverified user submission</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatReadableTimestamp(rep.createdAt)}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#20332B]">{rep.title}</h3>
                  <p className="text-sm text-[#66786E] leading-relaxed">
                    {rep.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
