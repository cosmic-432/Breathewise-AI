import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { apiClient } from '../api/client.ts';
import { AqiStatusIndicator } from '../components/AqiStatusBadge.tsx';
import {
  TIME_BLOCKS,
  type TransportMode,
} from '../components/planner/plannerConstants.ts';
import { RoutineActivityForm } from '../components/planner/RoutineActivityForm.tsx';
import { RoutineBlockSection } from '../components/planner/RoutineBlockSection.tsx';
import { StructuredAIResponseCard } from '../components/StructuredAIResponseCard.tsx';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import type {
  ActivityCategory,
  RoutineActivity,
  RoutineRecommendation,
  StructuredAIResponse,
  TimeBlock,
} from '../types/index.ts';
import { generateRoutineRecommendation } from '../utils/routineEngine.ts';

interface PlannerPageProps {
  state: BreatheWiseState;
}

export function PlannerPage({ state }: PlannerPageProps) {
  const { routines, setRoutines, snapshot, household } = state;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ActivityCategory>('office_commute');
  const [preferredBlock, setPreferredBlock] = useState<TimeBlock>('morning');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [isOutdoor, setIsOutdoor] = useState(true);
  const [currentTransport, setCurrentTransport] =
    useState<TransportMode>('public_transit');
  const [formError, setFormError] = useState<string | null>(null);

  const [aiPlan, setAiPlan] = useState<StructuredAIResponse | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const recommendationsById = useMemo(() => {
    const map = new Map<string, RoutineRecommendation>();
    routines.forEach((act) => {
      map.set(act.id, generateRoutineRecommendation(act, snapshot, household));
    });
    return map;
  }, [routines, snapshot, household]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setCategory('office_commute');
    setPreferredBlock('morning');
    setDurationMinutes(30);
    setIsOutdoor(true);
    setCurrentTransport('public_transit');
    setFormError(null);
  };

  const handleStartEdit = (act: RoutineActivity) => {
    setEditingId(act.id);
    setTitle(act.title);
    setCategory(act.category);
    setPreferredBlock(act.preferredBlock);
    setDurationMinutes(act.durationMinutes);
    setIsOutdoor(act.isOutdoor);
    setCurrentTransport(act.currentTransport ?? 'none');
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddActivity = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = title.trim();
    if (cleaned.length < 2) {
      setFormError('Please enter an activity title (at least 2 characters).');
      return;
    }
    setFormError(null);
    const activityPayload: RoutineActivity = {
      id: editingId ?? `rt-${Date.now()}`,
      title: cleaned,
      category,
      preferredBlock,
      durationMinutes: Math.max(5, Math.min(480, Number(durationMinutes) || 30)),
      isOutdoor,
      currentTransport,
    };
    if (editingId) {
      setRoutines(
        routines.map((item) => (item.id === editingId ? activityPayload : item)),
      );
    } else {
      setRoutines([...routines, activityPayload]);
    }
    resetForm();
  };

  const handleRemove = (id: string) => {
    if (editingId === id) resetForm();
    setRoutines(routines.filter((r) => r.id !== id));
  };

  const handleAskAiReview = async () => {
    setLoadingAi(true);
    setAiError(null);
    try {
      const result = await apiClient.askAssistant({
        question:
          'Review my saved daily routine for today across morning, afternoon, evening, and night based on our local air quality and household profile. Highlight when reducing outdoor exposure matters more than active-transport emissions.',
        mode: 'routine',
        snapshot,
        household,
        routines,
      });
      setAiPlan(result);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Unable to generate AI routine review.',
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
            Smart Daily Routine Planner
          </h1>
          <p className="text-sm text-[#66786E] mt-1">
            Adapts commutes, workouts, errands, and family plans to real-time air quality
            and forecast windows.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleAskAiReview()}
          disabled={loadingAi || routines.length === 0}
          className="inline-flex items-center justify-center rounded-lg bg-[#237A57] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18543F] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          {loadingAi ? 'Reviewing Routine with AI...' : 'Optimize Day with Gemini AI'}
        </button>
      </div>

      <div className="rounded-xl border border-[#E1EAE4] bg-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#66786E]">
        <div className="flex flex-wrap items-center gap-2.5">
          <AqiStatusIndicator
            aqi={snapshot?.aqi}
            scale={snapshot?.aqiScale ?? 'US_EPA'}
            compact
          />
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            AQI {snapshot?.aqi ?? 'Unavailable'}
          </span>
        </div>
        <span>
          Health-first rule active: outdoor cycling/exercise is never recommended in
          heavily polluted air.
        </span>
      </div>

      <RoutineActivityForm
        editingId={editingId}
        title={title}
        category={category}
        preferredBlock={preferredBlock}
        durationMinutes={durationMinutes}
        isOutdoor={isOutdoor}
        currentTransport={currentTransport}
        formError={formError}
        onTitleChange={setTitle}
        onCategoryChange={setCategory}
        onPreferredBlockChange={setPreferredBlock}
        onDurationMinutesChange={setDurationMinutes}
        onIsOutdoorChange={setIsOutdoor}
        onCurrentTransportChange={setCurrentTransport}
        onSubmit={handleAddActivity}
        onCancelEdit={resetForm}
      />

      {aiError && (
        <div
          role="alert"
          className="rounded-xl border border-[#C94D53]/40 bg-[#FBECEE] p-4 text-sm text-[#962D32]"
        >
          {aiError}
        </div>
      )}

      {aiPlan && (
        <section
          aria-label="Gemini personalized daily plan"
          className="rounded-xl border border-[#237A57]/40 bg-white p-6 space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[#18543F]">
              Gemini AI Personalized Routine Review
            </h2>
            <button
              type="button"
              onClick={() => setAiPlan(null)}
              className="text-xs text-[#66786E] hover:text-[#20332B]"
            >
              Dismiss
            </button>
          </div>
          <StructuredAIResponseCard response={aiPlan} />
        </section>
      )}

      <div className="space-y-5">
        {TIME_BLOCKS.map((block) => (
          <RoutineBlockSection
            key={block.id}
            blockId={block.id}
            blockLabel={block.label}
            blockHours={block.hours}
            items={routines.filter((r) => r.preferredBlock === block.id)}
            recommendationsById={recommendationsById}
            onEdit={handleStartEdit}
            onRemove={handleRemove}
          />
        ))}
      </div>
    </div>
  );
}
