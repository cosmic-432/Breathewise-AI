import { useEffect, useState } from 'react';
import { apiClient } from '../api/client.ts';
import { AiGuidanceCard } from '../components/AiGuidanceCard.tsx';
import { CommunityChallengesGrid } from '../components/community/CommunityChallengesGrid.tsx';
import { CommunityReportsSection } from '../components/community/CommunityReportsSection.tsx';
import { useAiGuidance } from '../hooks/useAiGuidance.ts';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import { localStore } from '../storage/localStore.ts';
import type { CommunityChallenge, CommunityReport } from '../types/index.ts';

interface CommunityPageProps {
  state: BreatheWiseState;
}

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

  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);

  const aiCampaign = useAiGuidance();

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

  const handleSubmitReport = async (payload: {
    areaLabel: string;
    category: CommunityReport['category'];
    title: string;
    description: string;
  }): Promise<boolean> => {
    setReportFeedback(null);
    setSubmittingReport(true);
    try {
      const res = await apiClient.submitCommunityReport(payload);
      setReports(res.summary.reports);
      setReportFeedback({
        message: 'Posted to the community feed with an unverified user-submission label.',
        isError: false,
      });
      return true;
    } catch (err) {
      setReportFeedback({
        message: err instanceof Error ? err.message : 'Unable to submit community post.',
        isError: true,
      });
      return false;
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleGenerateCampaign = () =>
    aiCampaign.requestGuidance(
      {
        question: `Suggest a practical, privacy-respecting neighborhood or school clean-air awareness campaign for residents in ${location.name}, focusing on no-idling zones, zero leaf burning, and shared commuting.`,
        mode: 'community',
        snapshot,
      },
      'Unable to generate community campaign ideas.',
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#20332B]">
            Community Action Hub
          </h1>
          <p className="text-sm text-[#52645A] mt-1">
            Voluntary low-emission challenges, clean-air tips, and neighborhood
            initiatives with genuine participation tracking.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleGenerateCampaign()}
          disabled={aiCampaign.loading}
          className="inline-flex items-center justify-center rounded-lg bg-[#237A57] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18543F] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          {aiCampaign.loading ? 'Drafting Campaign Idea...' : 'AI Campaign Idea'}
        </button>
      </div>

      {/* Authentic Recorded Totals (Zero Fabricated Numbers) */}
      <div className="rounded-xl border border-[#E1EAE4] bg-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-[#52645A]">Verified Voluntary Participants</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#18543F]">
              {totalParticipants}
            </p>
          </div>
          <div className="border-l border-[#E1EAE4] pl-6">
            <p className="text-xs text-[#52645A]">Community Actions Logged</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#20332B]">
              {totalActions}
            </p>
          </div>
        </div>
        <p className="text-xs text-[#52645A] max-w-md">
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

      <AiGuidanceCard
        title="Gemini Community Campaign Blueprint"
        response={aiCampaign.response}
        error={aiCampaign.error}
        onDismiss={aiCampaign.dismiss}
      />

      <CommunityChallengesGrid
        challenges={challenges}
        loading={loading}
        joinedIds={joinedIds}
        busyId={busyId}
        onParticipate={(challengeId, action) =>
          void handleParticipate(challengeId, action)
        }
      />

      <CommunityReportsSection
        defaultAreaLabel={location.name}
        reports={reports}
        submittingReport={submittingReport}
        reportFeedback={reportFeedback?.message ?? null}
        reportFeedbackIsError={reportFeedback?.isError ?? false}
        onSubmitReport={handleSubmitReport}
      />
    </div>
  );
}
