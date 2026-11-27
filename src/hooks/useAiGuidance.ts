import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client.ts';
import type { StructuredAIResponse } from '../types/index.ts';

export type AiGuidancePayload = Parameters<typeof apiClient.askAssistant>[0];

export interface UseAiGuidanceResult {
  response: StructuredAIResponse | null;
  loading: boolean;
  error: string | null;
  requestGuidance: (
    payload: AiGuidancePayload,
    fallbackErrorMessage: string,
  ) => Promise<void>;
  dismiss: () => void;
  clearError: () => void;
}

/**
 * Shared state manager for one-shot Gemini structured guidance cards.
 * Handles loading/error states, cancels in-flight requests on unmount or superseding calls,
 * and prevents stale updates from resolved aborted promises.
 */
export function useAiGuidance(): UseAiGuidanceResult {
  const [response, setResponse] = useState<StructuredAIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const requestGuidance = useCallback(
    async (payload: AiGuidancePayload, fallbackErrorMessage: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const result = await apiClient.askAssistant(payload, controller.signal);
        if (
          !mountedRef.current ||
          controller.signal.aborted ||
          abortRef.current !== controller
        ) {
          return;
        }
        setResponse(result);
      } catch (err) {
        if (
          !mountedRef.current ||
          controller.signal.aborted ||
          abortRef.current !== controller ||
          (err instanceof DOMException && err.name === 'AbortError')
        ) {
          return;
        }
        setError(err instanceof Error ? err.message : fallbackErrorMessage);
      } finally {
        if (mountedRef.current && abortRef.current === controller) {
          setLoading(false);
          abortRef.current = null;
        }
      }
    },
    [],
  );

  const dismiss = useCallback(() => {
    setResponse(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    response,
    loading,
    error,
    requestGuidance,
    dismiss,
    clearError,
  };
}
