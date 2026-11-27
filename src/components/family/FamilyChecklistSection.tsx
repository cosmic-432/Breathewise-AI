import type { FormEvent } from 'react';
import { useState } from 'react';
import { CheckSquare, Plus, RotateCcw, Square, Trash2 } from 'lucide-react';
import type { FamilyChecklistItem } from '../../types/index.ts';
import { createEntityId } from '../../utils/id.ts';
import { isOneOf } from '../../utils/typeGuards.ts';

const CHECKLIST_AUDIENCES: readonly FamilyChecklistItem['audience'][] = [
  'household',
  'children',
  'older_adults',
  'sensitive',
  'outdoor_workers',
];

interface FamilyChecklistSectionProps {
  checklist: FamilyChecklistItem[];
  onChange: (next: FamilyChecklistItem[]) => void;
}

export function FamilyChecklistSection({
  checklist,
  onChange,
}: FamilyChecklistSectionProps) {
  const [newTask, setNewTask] = useState('');
  const [newAudience, setNewAudience] =
    useState<FamilyChecklistItem['audience']>('household');

  const toggleChecklist = (id: string) => {
    onChange(
      checklist.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item,
      ),
    );
  };

  const addChecklistItem = (e: FormEvent) => {
    e.preventDefault();
    const text = newTask.trim();
    if (text.length < 3) return;
    onChange([
      ...checklist,
      {
        id: createEntityId('chk'),
        text,
        audience: newAudience,
        completed: false,
      },
    ]);
    setNewTask('');
  };

  return (
    <section
      aria-labelledby="family-checklist-heading"
      className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2
            id="family-checklist-heading"
            className="text-base font-semibold text-[#20332B]"
          >
            Daily Household Checklist
          </h2>
          <p className="text-xs text-[#66786E]">
            {checklist.filter((c) => c.completed).length} of {checklist.length} completed
            today
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(checklist.map((c) => ({ ...c, completed: false })))}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#66786E] hover:text-[#20332B]"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reset Today</span>
        </button>
      </div>

      <ul className="divide-y divide-[#E1EAE4]">
        {checklist.map((item) => (
          <li key={item.id} className="py-3 flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => toggleChecklist(item.id)}
              aria-pressed={item.completed}
              className="flex items-start gap-3 text-left flex-1 group"
            >
              {item.completed ? (
                <CheckSquare
                  className="w-4 h-4 text-[#237A57] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Square
                  className="w-4 h-4 text-[#66786E] group-hover:text-[#237A57] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
              )}
              <div>
                <span
                  className={`text-sm ${
                    item.completed ? 'line-through text-[#66786E]' : 'text-[#20332B]'
                  }`}
                >
                  {item.text}
                </span>
                <span className="block text-[11px] text-[#66786E] capitalize">
                  Focus: {item.audience.replace(/_/g, ' ')}
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onChange(checklist.filter((c) => c.id !== item.id))}
              aria-label={`Delete checklist item: ${item.text}`}
              className="text-[#66786E] hover:text-[#C94D53] p-1"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={addChecklistItem}
        className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-[#E1EAE4]"
      >
        <label htmlFor="new-checklist-item" className="sr-only">
          Add daily checklist item
        </label>
        <input
          id="new-checklist-item"
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Add a daily family step..."
          className="flex-1 rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3.5 py-2 text-sm text-[#20332B] focus:bg-white focus:border-[#237A57] focus:ring-2 focus:ring-[#237A57]/25"
        />
        <select
          aria-label="Audience for checklist item"
          value={newAudience}
          onChange={(e) => {
            if (isOneOf(e.target.value, CHECKLIST_AUDIENCES)) {
              setNewAudience(e.target.value);
            }
          }}
          className="rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B]"
        >
          <option value="household">Whole Household</option>
          <option value="children">Children</option>
          <option value="older_adults">Older Adults</option>
          <option value="sensitive">Sensitive Members</option>
          <option value="outdoor_workers">Outdoor Workers</option>
        </select>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#18543F] px-4 py-2 text-sm font-medium text-white hover:bg-[#237A57] transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add</span>
        </button>
      </form>
    </section>
  );
}
