export interface ImpactTotals {
  co2Kg: number;
  fuelLiters: number;
  tripsReduced: number;
  kwhSaved: number;
}

interface ImpactKpiStripProps {
  totals: ImpactTotals;
  actionCount: number;
}

export function ImpactKpiStrip({ totals, actionCount }: ImpactKpiStripProps) {
  const kpis = [
    {
      label: 'Estimated CO2 Avoided',
      value: `${totals.co2Kg} kg`,
      sub: 'Deterministic logged total',
    },
    {
      label: 'Estimated Fuel Saved',
      value: `${totals.fuelLiters} L`,
      sub: 'Petrol-equivalent baseline',
    },
    {
      label: 'Vehicle Trips Reduced',
      value: String(totals.tripsReduced),
      sub: 'Carpool, transit & batched errands',
    },
    {
      label: 'Household Energy Saved',
      value: `${totals.kwhSaved} kWh`,
      sub: `${actionCount} logged action(s)`,
    },
  ];

  return (
    <section aria-label="Your cumulative recorded impact">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-[#E1EAE4] bg-white p-5"
          >
            <p className="text-xs font-medium text-[#52645A]">{kpi.label}</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#18543F] mt-1.5">
              {kpi.value}
            </p>
            <p className="text-xs text-[#52645A] mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
