import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client.ts';
import {
  DEFAULT_CHECKLIST,
  DEFAULT_HOUSEHOLD,
  DEFAULT_INDOOR,
  DEFAULT_LOCATION,
  DEFAULT_ROUTINES,
  localStore,
} from '../storage/localStore.ts';
import type {
  AirQualitySnapshot,
  ChatTurn,
  FamilyChecklistItem,
  HistoricalAqiRecord,
  HouseholdProfile,
  IndoorConditions,
  LocationSelection,
  RecordedImpactAction,
  RoutineActivity,
} from '../types/index.ts';

export function useBreatheWiseState() {
  const [location, setLocationState] = useState<LocationSelection>(() =>
    localStore.getLocation(),
  );
  const [snapshot, setSnapshot] = useState<AirQualitySnapshot | null>(null);
  const [loadingAqi, setLoadingAqi] = useState<boolean>(true);
  const [aqiError, setAqiError] = useState<string | null>(null);

  const [household, setHouseholdState] = useState<HouseholdProfile>(() =>
    localStore.getHousehold(),
  );
  const [routines, setRoutinesState] = useState<RoutineActivity[]>(() =>
    localStore.getRoutines(),
  );
  const [indoor, setIndoorState] = useState<IndoorConditions>(() =>
    localStore.getIndoor(),
  );
  const [checklist, setChecklistState] = useState<FamilyChecklistItem[]>(() =>
    localStore.getChecklist(),
  );
  const [impactActions, setImpactActionsState] = useState<RecordedImpactAction[]>(() =>
    localStore.getImpactActions(),
  );
  const [aqiHistory, setAqiHistory] = useState<HistoricalAqiRecord[]>(() =>
    localStore.getAqiHistory(),
  );
  const [chatTurns, setChatTurnsState] = useState<ChatTurn[]>(() =>
    localStore.getChatHistory(),
  );

  const abortRef = useRef<AbortController | null>(null);

  const fetchForLocation = useCallback(
    async (loc: LocationSelection, refresh: boolean, controller: AbortController) => {
      try {
        const data = await apiClient.fetchAirQuality(loc, {
          refresh,
          signal: controller.signal,
        });
        if (abortRef.current !== controller) return;
        setSnapshot(data);
        setAqiError(null);
        const updatedHistory = localStore.recordVerifiedAqiSnapshot(data);
        setAqiHistory(updatedHistory);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (abortRef.current !== controller) return;
        setAqiError(
          err instanceof Error
            ? err.message
            : 'Unable to fetch air-quality data right now.',
        );
      } finally {
        if (abortRef.current === controller) {
          setLoadingAqi(false);
        }
      }
    },
    [],
  );

  const loadAirQuality = useCallback(
    async (loc: LocationSelection, refresh: boolean = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoadingAqi(true);
      setAqiError(null);
      await fetchForLocation(loc, refresh, controller);
    },
    [fetchForLocation],
  );

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    apiClient
      .fetchAirQuality(location, {
        refresh: false,
        signal: controller.signal,
      })
      .then((data) => {
        if (abortRef.current !== controller) return;
        setSnapshot(data);
        setAqiError(null);
        const updatedHistory = localStore.recordVerifiedAqiSnapshot(data);
        setAqiHistory(updatedHistory);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (abortRef.current !== controller) return;
        setAqiError(
          err instanceof Error
            ? err.message
            : 'Unable to fetch air-quality data right now.',
        );
      })
      .finally(() => {
        if (abortRef.current === controller) {
          setLoadingAqi(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [location]);

  const setLocation = useCallback((next: LocationSelection) => {
    localStore.setLocation(next);
    setLoadingAqi(true);
    setAqiError(null);
    setLocationState(next);
  }, []);

  const setHousehold = useCallback((next: HouseholdProfile) => {
    localStore.setHousehold(next);
    setHouseholdState(next);
  }, []);

  const setRoutines = useCallback((next: RoutineActivity[]) => {
    localStore.setRoutines(next);
    setRoutinesState(next);
  }, []);

  const setIndoor = useCallback((next: IndoorConditions) => {
    localStore.setIndoor(next);
    setIndoorState(next);
  }, []);

  const setChecklist = useCallback((next: FamilyChecklistItem[]) => {
    localStore.setChecklist(next);
    setChecklistState(next);
  }, []);

  const addImpactAction = useCallback((action: RecordedImpactAction) => {
    setImpactActionsState((prev) => {
      const next = [action, ...prev];
      localStore.setImpactActions(next);
      return next;
    });
  }, []);

  const removeImpactAction = useCallback((id: string) => {
    setImpactActionsState((prev) => {
      const next = prev.filter((item) => item.id !== id);
      localStore.setImpactActions(next);
      return next;
    });
  }, []);

  const setChatTurns = useCallback(
    (updater: ChatTurn[] | ((prev: ChatTurn[]) => ChatTurn[])) => {
      setChatTurnsState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        localStore.setChatHistory(next);
        return next;
      });
    },
    [],
  );

  const resetAllLocalData = useCallback(() => {
    localStore.clearAllUserData();
    setLocationState(DEFAULT_LOCATION);
    setHouseholdState(DEFAULT_HOUSEHOLD);
    setRoutinesState(DEFAULT_ROUTINES);
    setIndoorState(DEFAULT_INDOOR);
    setChecklistState(DEFAULT_CHECKLIST);
    setImpactActionsState([]);
    setAqiHistory([]);
    setChatTurnsState([]);
  }, []);

  return {
    location,
    setLocation,
    snapshot,
    loadingAqi,
    aqiError,
    refreshAirQuality: () => loadAirQuality(location, true),
    household,
    setHousehold,
    routines,
    setRoutines,
    indoor,
    setIndoor,
    checklist,
    setChecklist,
    impactActions,
    addImpactAction,
    removeImpactAction,
    aqiHistory,
    chatTurns,
    setChatTurns,
    resetAllLocalData,
  };
}

export type BreatheWiseState = ReturnType<typeof useBreatheWiseState>;
