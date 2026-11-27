import { Trash2 } from 'lucide-react';
import type { RecordedImpactAction } from '../../types/index.ts';

interface ImpactActionsTableProps {
  actions: RecordedImpactAction[];
  onRemoveAction: (id: string) => void;
}

export function ImpactActionsTable({ actions, onRemoveAction }: ImpactActionsTableProps) {
  return (
    <section
      aria-labelledby="logged-actions-heading"
      className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
    >
      <h2 id="logged-actions-heading" className="text-base font-semibold text-[#20332B]">
        Your Recorded Sustainable Actions ({actions.length})
      </h2>

      {actions.length === 0 ? (
        <p className="text-sm text-[#66786E]">
          No actions logged yet. Configure an action above and click &ldquo;Record Action
          &amp; Update My Impact&rdquo; to track your verified progress.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#E1EAE4] text-xs text-[#66786E]">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 pr-4 font-medium text-right">CO2 Avoided</th>
                <th className="py-2 pr-4 font-medium text-right">Fuel / Energy</th>
                <th className="py-2 pr-4 font-medium text-right">Trips</th>
                <th className="py-2 font-medium text-right">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1EAE4]">
              {actions.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 pr-4 text-xs font-mono tabular-nums text-[#66786E] whitespace-nowrap">
                    {new Date(item.dateIso).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 pr-4 text-[#20332B] font-medium">{item.label}</td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#18543F]">
                    {item.co2AvoidedKg !== null
                      ? `${item.co2AvoidedKg} kg`
                      : 'Qualitative'}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#20332B]">
                    {item.kwhSaved !== null
                      ? `${item.kwhSaved} kWh`
                      : item.fuelSavedLiters !== null
                        ? `${item.fuelSavedLiters} L`
                        : '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#20332B]">
                    {item.tripsReduced}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onRemoveAction(item.id)}
                      aria-label={`Delete logged action ${item.label}`}
                      className="text-[#66786E] hover:text-[#C94D53] p-1"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
