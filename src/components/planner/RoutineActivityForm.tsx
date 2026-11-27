import type { FormEvent } from 'react';
import { Plus } from 'lucide-react';
import type { ActivityCategory, TimeBlock } from '../../types/index.ts';
import { isOneOf } from '../../utils/typeGuards.ts';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_LABELS,
  TIME_BLOCKS,
  TIME_BLOCK_IDS,
  TRANSPORT_MODES,
  type TransportMode,
} from './plannerConstants.ts';

interface RoutineActivityFormProps {
  editingId: string | null;
  title: string;
  category: ActivityCategory;
  preferredBlock: TimeBlock;
  durationMinutes: number;
  isOutdoor: boolean;
  currentTransport: TransportMode;
  formError: string | null;
  onTitleChange: (value: string) => void;
  onCategoryChange: (value: ActivityCategory) => void;
  onPreferredBlockChange: (value: TimeBlock) => void;
  onDurationMinutesChange: (value: number) => void;
  onIsOutdoorChange: (value: boolean) => void;
  onCurrentTransportChange: (value: TransportMode) => void;
  onSubmit: (e: FormEvent) => void;
  onCancelEdit: () => void;
}

export function RoutineActivityForm({
  editingId,
  title,
  category,
  preferredBlock,
  durationMinutes,
  isOutdoor,
  currentTransport,
  formError,
  onTitleChange,
  onCategoryChange,
  onPreferredBlockChange,
  onDurationMinutesChange,
  onIsOutdoorChange,
  onCurrentTransportChange,
  onSubmit,
  onCancelEdit,
}: RoutineActivityFormProps) {
  return (
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
      <form onSubmit={onSubmit} className="space-y-4">
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
              onChange={(e) => onTitleChange(e.target.value)}
              aria-invalid={Boolean(formError)}
              aria-describedby={formError ? 'routine-form-error' : undefined}
              placeholder="e.g., Morning jog, School drop-off"
              className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3.5 py-2 text-sm text-[#20332B] focus:bg-white focus:border-[#237A57] focus:ring-2 focus:ring-[#237A57]/25"
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
              onChange={(e) => {
                if (isOneOf(e.target.value, ACTIVITY_CATEGORIES)) {
                  onCategoryChange(e.target.value);
                }
              }}
              className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B] focus:bg-white focus:border-[#237A57] focus:ring-2 focus:ring-[#237A57]/25"
            >
              {ACTIVITY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {ACTIVITY_LABELS[cat]}
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
              onChange={(e) => {
                if (isOneOf(e.target.value, TIME_BLOCK_IDS)) {
                  onPreferredBlockChange(e.target.value);
                }
              }}
              className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B] focus:bg-white focus:border-[#237A57] focus:ring-2 focus:ring-[#237A57]/25"
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
              onChange={(e) => {
                if (isOneOf(e.target.value, TRANSPORT_MODES)) {
                  onCurrentTransportChange(e.target.value);
                }
              }}
              className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B] focus:bg-white focus:border-[#237A57] focus:ring-2 focus:ring-[#237A57]/25"
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
                onChange={(e) => onDurationMinutesChange(Number(e.target.value))}
                className="w-20 rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-2.5 py-1.5 text-sm font-mono tabular-nums text-[#20332B]"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-[#20332B] cursor-pointer">
              <input
                type="checkbox"
                checked={isOutdoor}
                onChange={(e) => onIsOutdoorChange(e.target.checked)}
                className="h-4 w-4 accent-[#237A57]"
              />
              <span>Involves outdoor time</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            {editingId && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-lg border border-[#E1EAE4] px-3.5 py-2 text-sm font-medium text-[#52645A] hover:text-[#20332B] transition-colors whitespace-nowrap"
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
  );
}
