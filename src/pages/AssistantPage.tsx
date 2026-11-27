import { useRef, useState } from 'react';
import { MapPin, Send, Square, Trash2 } from 'lucide-react';
import { apiClient } from '../api/client.ts';
import { AqiStatusIndicator } from '../components/AqiStatusBadge.tsx';
import { StructuredAIResponseCard } from '../components/StructuredAIResponseCard.tsx';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import type { ChatTurn } from '../types/index.ts';

interface AssistantPageProps {
  state: BreatheWiseState;
  onOpenLocationModal: () => void;
}

const EXAMPLE_PROMPTS = [
  'The AQI in my area is poor today. I need to commute to college and my family has elderly members at home. What should we do today?',
  'Is it safe to open windows for fresh air right now, and how should we manage cooking fumes indoors?',
  'What lower-emission commuting choices make sense today without increasing my smog exposure?',
  'Explain today’s pollutant readings in plain language and what they mean for children playing outdoors.',
];

export function AssistantPage({
  state,
  onOpenLocationModal,
}: AssistantPageProps) {
  const {
    snapshot,
    location,
    household,
    indoor,
    routines,
    chatTurns,
    setChatTurns,
  } = state;

  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendQuestion = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (question.length < 3 || submitting) return;

    const userTurn: ChatTurn = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: question,
      createdAt: new Date().toISOString(),
    };

    const historyForApi = chatTurns.slice(-6).map((t) => ({
      role: t.role,
      text: t.role === 'assistant' && t.structured ? t.structured.summary : t.text,
    }));

    setChatTurns((prev) => [...prev, userTurn]);
    setInput('');
    setSubmitting(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const structured = await apiClient.askAssistant(
        {
          question,
          mode: 'assistant',
          history: historyForApi,
          snapshot,
          household,
          indoor,
          routines,
        },
        controller.signal,
      );

      const assistantTurn: ChatTurn = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        text: structured.summary,
        structured,
        createdAt: new Date().toISOString(),
      };
      setChatTurns((prev) => [...prev, assistantTurn]);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to reach BreatheWise AI right now.';
      const errTurn: ChatTurn = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: '',
        error: message,
        createdAt: new Date().toISOString(),
      };
      setChatTurns((prev) => [...prev, errTurn]);
    } finally {
      setSubmitting(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#20332B]">
            BreatheWise AI Assistant
          </h1>
          <p className="text-sm text-[#66786E] mt-1">
            Location-aware guidance grounded in your current air-quality data, household profile, and routines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenLocationModal}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E1EAE4] bg-white px-3.5 py-2 text-sm font-medium text-[#20332B] hover:bg-[#F5F8F6] transition-colors whitespace-nowrap"
          >
            <MapPin className="w-4 h-4 text-[#237A57]" aria-hidden="true" />
            <span>{location.name}</span>
          </button>
          {chatTurns.length > 0 && (
            <button
              type="button"
              onClick={() => setChatTurns([])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E1EAE4] bg-white px-3.5 py-2 text-xs font-medium text-[#66786E] hover:text-[#20332B] hover:bg-[#F5F8F6] transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Grounding Context Strip */}
      <div className="rounded-xl border border-[#E1EAE4] bg-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#66786E]">
          <span className="font-semibold text-[#20332B]">Grounded context:</span>
          <AqiStatusIndicator
            aqi={snapshot?.aqi}
            scale={snapshot?.aqiScale ?? 'US_EPA'}
            compact
          />
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            AQI {snapshot?.aqi ?? 'Unavailable'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Household: {household.memberCount} member(s)
          </span>
          <span aria-hidden="true">·</span>
          <span>{routines.length} routine(s) saved</span>
        </div>
        <span className="text-xs text-[#66786E]">
          Educational guidance only — not medical advice
        </span>
      </div>

      {/* Conversation Container */}
      <div className="rounded-xl border border-[#E1EAE4] bg-white overflow-hidden">
        <div
          className="p-6 space-y-6 min-h-[340px] max-h-[60vh] overflow-y-auto"
          aria-live="polite"
        >
          {chatTurns.length === 0 ? (
            <div className="space-y-5 py-4">
              <div className="max-w-2xl">
                <h2 className="text-base font-semibold text-[#20332B]">
                  Ask a question about today’s air quality
                </h2>
                <p className="text-sm text-[#66786E] mt-1 leading-relaxed">
                  BreatheWise AI reads your verified local air-quality snapshot and household preferences, clearly separates data-backed guidance from general advice, and never fabricates live numbers.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendQuestion(prompt)}
                    className="rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-4 py-3 text-left text-sm text-[#20332B] hover:border-[#237A57] hover:bg-[#DDF1E6]/40 transition-colors leading-snug"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chatTurns.map((turn) => (
              <div
                key={turn.id}
                className={
                  turn.role === 'user'
                    ? 'flex justify-end'
                    : 'border-t border-[#E1EAE4] pt-5 first:border-t-0 first:pt-0'
                }
              >
                {turn.role === 'user' ? (
                  <div className="max-w-2xl rounded-xl bg-[#18543F] px-4 py-3 text-sm text-white leading-relaxed">
                    {turn.text}
                  </div>
                ) : turn.error ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-[#C94D53]/40 bg-[#FBECEE] px-4 py-3 text-sm text-[#962D32]"
                  >
                    <p className="font-semibold">AI Request Error</p>
                    <p className="mt-0.5">{turn.error}</p>
                  </div>
                ) : turn.structured ? (
                  <StructuredAIResponseCard response={turn.structured} />
                ) : (
                  <p className="text-sm text-[#20332B]">{turn.text}</p>
                )}
              </div>
            ))
          )}

          {submitting && (
            <div className="border-t border-[#E1EAE4] pt-5 flex items-center justify-between gap-4 text-sm text-[#66786E]">
              <span>Analyzing verified local air quality and household context...</span>
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E1EAE4] px-3 py-1.5 text-xs font-medium text-[#20332B] hover:bg-[#F5F8F6]"
              >
                <Square className="w-3 h-3" aria-hidden="true" />
                <span>Cancel</span>
              </button>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendQuestion(input);
          }}
          className="border-t border-[#E1EAE4] bg-[#F5F8F6] p-4"
        >
          <label htmlFor="ai-question-input" className="sr-only">
            Ask BreatheWise AI a question
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="ai-question-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1200}
              placeholder="Ask about commuting, elderly care, indoor ventilation, or lower-emission routines..."
              className="flex-1 rounded-lg border border-[#E1EAE4] bg-white px-4 py-2.5 text-sm text-[#20332B] placeholder:text-[#66786E] focus:border-[#237A57] focus:outline-none"
            />
            <button
              type="submit"
              disabled={submitting || input.trim().length < 3}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#237A57] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#18543F] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>Ask Assistant</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
