import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../api/client.ts';
import { AqiStatusIndicator } from '../components/AqiStatusBadge.tsx';
import { StructuredAIResponseCard } from '../components/StructuredAIResponseCard.tsx';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import type {
  ActivityCategory,
  RoutineActivity,
  StructuredAIResponse,
  TimeBlock,
} from '../types/index.ts';
import { generateRoutineRecommendation } from '../utils/routineEngine.ts';

interface PlannerPageProps {
  state: BreatheWiseState;
}

const ACTIVITY_LABELS: Record<ActivityCategory, string> = {
  school_college_commute: 'School / College Commute',
  office_commute: 'Office Commute',
  shopping: 'Shopping / Errands',
  exercise: 'Exercise / Sports',
  outdoor_work: 'Outdoor Work',
  walking: 'Walking',
  family_activities: 'Family Activities',
  other: 'Other Activity',
};

const TIME_BLOCKS: Array<{ id: TimeBlock; label: string; hours: string }> = [
  { id: 'morning', label: 'Morning', hours: '06:00 – 11:59' },
  { id: 'afternoon', label: 'Afternoon', hours: '12:00 – 16:59' },
  { id: 'evening', label: 'Evening', hours: '17:00 – 20:59' },
  { id: 'night', label: 'Night', hours: '21:00 – 23:59' },
];

export function PlannerPage({ state }: PlannerPageProps) {
  const { routines, setRoutines, snapshot, household } = state;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ActivityCategory>('office_commute');
  const [preferredBlock, setPreferredBlock] = useState<TimeBlock>('morning');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [isOutdoor, setIsOutdoor] = useState(true);
  const [currentTransport, setCurrentTransport] =
    useState<NonNullable<RoutineActivity['currentTransport']>>('public_transit');
  const [formError, setFormError] = useState<string | null>(null);

  const [aiPlan, setAiPlan] = useState<StructuredAIResponse | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const recommendationsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof generateRoutineRecommendation>>();
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

  const handleAddActivity = (e: React.FormEvent) => {
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
            Adapts commutes, workouts, errands, and family plans to real-time air quality and forecast windows.
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

      {/* Current Condition Context Bar */}
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
          Health-first rule active: outdoor cycling/exercise is never recommended in heavily polluted air.
        </span>
      </div>

      {/* Add Activity Form */}
      <section
        aria-labelledby="add-activity-heading"
        className="rounded-xl border border-[#E1EAE4] bg-white p-6"
      >
        <h2
          id="add-activity-heading"
          className="text-base font-semibold text-[#20332B] mb-4"
        >
          {editingId ? 'Edit Routine Activity' : 'Add Routine Activity'}
        </h2>
        <form onSubmit={handleAddActivity} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4">
              <label
                htmlFor="routine-title"
                className="block text-xs font-medium text-[#20332B] mb-1.5"
              >
                Activity name
              </label>
              <input
                id="routine-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-invalid={Boolean(formError)}
                aria-describedby={formError ? 'routine-form-error' : undefined}
                placeholder="e.g., Morning jog, School drop-off"
                className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3.5 py-2 text-sm text-[#20332B] focus:bg-white focus:border-[#237A57] focus:outline-none"
              />
            </div>

            <div className="md:col-span-3">
              <label
                htmlFor="routine-category"
                className="block text-xs font-medium text-[#20332B] mb-1.5"
              >
                Category
              </label>
              <select
                id="routine-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ActivityCategory)}
                className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B] focus:bg-white focus:border-[#237A57] focus:outline-none"
              >
                {Object.entries(ACTIVITY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="routine-block"
                className="block text-xs font-medium text-[#20332B] mb-1.5"
              >
                Time of day
              </label>
              <select
                id="routine-block"
                value={preferredBlock}
                onChange={(e) => setPreferredBlock(e.target.value as TimeBlock)}
                className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B] focus:bg-white focus:border-[#237A57] focus:outline-none"
              >
                {TIME_BLOCKS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label
                htmlFor="routine-transport"
                className="block text-xs font-medium text-[#20332B] mb-1.5"
              >
                Current transport
              </label>
              <select
                id="routine-transport"
                value={currentTransport}
                onChange={(e) =>
                  setCurrentTransport(
                    e.target.value as NonNullable<RoutineActivity['currentTransport']>,
                  )
                }
                className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B] focus:bg-white focus:border-[#237A57] focus:outline-none"
              >
                <option value="public_transit">Public Transit / Metro</option>
                <option value="car_solo">Solo Car</option>
                <option value="carpool">Carpool</option>
                <option value="two_wheeler">Two-Wheeler</option>
                <option value="walk_cycle">Walking / Cycling</option>
                <option value="none">No Travel Required</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="routine-duration"
                  className="text-xs font-medium text-[#20332B]"
                >
                  Duration (min)
                </label>
                <input
                  id="routine-duration"
                  type="number"
                  min={5}
                  max={480}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-20 rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-2.5 py-1.5 text-sm font-mono tabular-nums text-[#20332B]"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-[#20332B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOutdoor}
                  onChange={(e) => setIsOutdoor(e.target.checked)}
                  className="h-4 w-4 accent-[#237A57]"
                />
                <span>Involves outdoor time</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-[#E1EAE4] px-3.5 py-2 text-sm font-medium text-[#66786E] hover:text-[#20332B] transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#18543F] px-4 py-2 text-sm font-medium text-white hover:bg-[#237A57] transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{editingId ? 'Save Changes' : 'Add to Daily Plan'}</span>
              </button>
            </div>
          </div>

          {formError && (
            <p id="routine-form-error" role="alert" className="text-xs text-[#C94D53]">
              {formError}
            </p>
          )}
        </form>
      </section>

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

      {/* Time-Block Routine Schedule */}
      <div className="space-y-5">
        {TIME_BLOCKS.map((block) => {
          const items = routines.filter((r) => r.preferredBlock === block.id);
          return (
            <section
              key={block.id}
              aria-labelledby={`block-${block.id}`}
              className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
            >
              <div className="flex items-baseline justify-between gap-2 border-b border-[#E1EAE4] pb-3">
                <h2
                  id={`block-${block.id}`}
                  className="text-base font-semibold text-[#20332B]"
                >
                  {block.label}
                </h2>
                <span className="text-xs font-mono tabular-nums text-[#66786E]">
                  {block.hours} · {items.length} activity(s)
                </span>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-[#66786E]">
                  No activities scheduled for {block.label.toLowerCase()}.
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
                              onClick={() => handleStartEdit(act)}
                              aria-label={`Edit ${act.title}`}
                              className="inline-flex items-center gap-1 text-xs text-[#66786E] hover:text-[#18543F] transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemove(act.id)}
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
                            <strong className="font-semibold">
                              Health priority:{' '}
                            </strong>
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
        })}
      </div>
    </div>
  );
}
