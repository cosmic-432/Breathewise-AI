import { useEffect, useMemo, useRef, useState } from 'react';
import { ImpactActionsTable } from '../components/impact/ImpactActionsTable.tsx';
import { ImpactKpiStrip } from '../components/impact/ImpactKpiStrip.tsx';
import { ImpactResultsPanel } from '../components/impact/ImpactResultsPanel.tsx';
import {
  IMPACT_ACTION_OPTIONS,
  ImpactScenarioForm,
} from '../components/impact/ImpactScenarioForm.tsx';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import type {
  HouseholdProfile,
  ImpactActionType,
  RecordedImpactAction,
} from '../types/index.ts';
import { calculateEnvironmentalImpact } from '../utils/impactCalculator.ts';

interface ImpactCalculatorPageProps {
  state: BreatheWiseState;
}

export function ImpactCalculatorPage({ state }: ImpactCalculatorPageProps) {
  const { household, impactActions, addImpactAction, removeImpactAction } = state;

  const [actionType, setActionType] = useState<ImpactActionType>('carpool');
  const [distanceKm, setDistanceKm] = useState(14);
  const [passengersShared, setPassengersShared] = useState(3);
  const [tripsConsolidated, setTripsConsolidated] = useState(2);
  const [kwhSaved, setKwhSaved] = useState(20);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [regionGrid, setRegionGrid] = useState<HouseholdProfile['regionGrid']>(
    household.regionGrid,
  );
  const [justLogged, setJustLogged] = useState(false);
  const loggedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (loggedTimerRef.current !== null) {
        clearTimeout(loggedTimerRef.current);
      }
    };
  }, []);

  const result = useMemo(
    () =>
      calculateEnvironmentalImpact({
        type: actionType,
        distanceKm,
        passengersShared,
        tripsConsolidated,
        kwhSaved,
        daysPerWeek,
        regionGrid,
      }),
    [
      actionType,
      distanceKm,
      passengersShared,
      tripsConsolidated,
      kwhSaved,
      daysPerWeek,
      regionGrid,
    ],
  );

  const totals = useMemo(() => {
    return impactActions.reduce(
      (acc, item) => ({
        co2Kg: Number((acc.co2Kg + (item.co2AvoidedKg ?? 0)).toFixed(2)),
        fuelLiters: Number((acc.fuelLiters + (item.fuelSavedLiters ?? 0)).toFixed(2)),
        tripsReduced: acc.tripsReduced + item.tripsReduced,
        kwhSaved: Number((acc.kwhSaved + (item.kwhSaved ?? 0)).toFixed(1)),
      }),
      { co2Kg: 0, fuelLiters: 0, tripsReduced: 0, kwhSaved: 0 },
    );
  }, [impactActions]);

  const handleLogAction = () => {
    const label =
      IMPACT_ACTION_OPTIONS.find((a) => a.id === actionType)?.label ?? actionType;
    const entry: RecordedImpactAction = {
      id: `imp-${Date.now()}`,
      type: actionType,
      label,
      dateIso: new Date().toISOString(),
      quantity:
        actionType === 'electricity_reduction'
          ? kwhSaved
          : actionType === 'combine_errands'
            ? tripsConsolidated
            : daysPerWeek,
      unit:
        actionType === 'electricity_reduction'
          ? 'kWh'
          : actionType === 'combine_errands'
            ? 'trips'
            : 'days',
      co2AvoidedKg: result.co2AvoidedKg,
      fuelSavedLiters: result.fuelSavedLiters,
      tripsReduced: result.tripsReduced,
      kwhSaved: result.kwhSaved,
      regionGrid,
    };
    addImpactAction(entry);
    setJustLogged(true);
    if (loggedTimerRef.current !== null) {
      clearTimeout(loggedTimerRef.current);
    }
    loggedTimerRef.current = setTimeout(() => {
      setJustLogged(false);
      loggedTimerRef.current = null;
    }, 2200);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#20332B]">
          Environmental Impact Calculator
        </h1>
        <p className="text-sm text-[#66786E] mt-1">
          Transparent, deterministic calculations showing your estimated CO2, fuel, trip,
          and electricity savings — with explicit assumptions and uncertainty.
        </p>
      </div>

      <ImpactKpiStrip totals={totals} actionCount={impactActions.length} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <ImpactScenarioForm
          actionType={actionType}
          distanceKm={distanceKm}
          passengersShared={passengersShared}
          tripsConsolidated={tripsConsolidated}
          kwhSaved={kwhSaved}
          daysPerWeek={daysPerWeek}
          regionGrid={regionGrid}
          justLogged={justLogged}
          onActionTypeChange={setActionType}
          onDistanceKmChange={setDistanceKm}
          onPassengersSharedChange={setPassengersShared}
          onTripsConsolidatedChange={setTripsConsolidated}
          onKwhSavedChange={setKwhSaved}
          onDaysPerWeekChange={setDaysPerWeek}
          onRegionGridChange={setRegionGrid}
          onLogAction={handleLogAction}
        />

        <ImpactResultsPanel result={result} />
      </div>

      <ImpactActionsTable actions={impactActions} onRemoveAction={removeImpactAction} />
    </div>
  );
}
