import type { FormEvent } from 'react';
import { useState } from 'react';
import type { CommunityReport } from '../../types/index.ts';
import { formatReadableTimestamp } from '../../utils/aqi.ts';
import { isOneOf } from '../../utils/typeGuards.ts';

const REPORT_CATEGORIES: readonly CommunityReport['category'][] = [
  'tip',
  'initiative',
  'observation',
];

interface CommunityReportsSectionProps {
  defaultAreaLabel: string;
  reports: CommunityReport[];
  submittingReport: boolean;
  reportFeedback: string | null;
  reportFeedbackIsError?: boolean;
  onSubmitReport: (payload: {
    areaLabel: string;
    category: CommunityReport['category'];
    title: string;
    description: string;
  }) => Promise<boolean>;
}

export function CommunityReportsSection({
  defaultAreaLabel,
  reports,
  submittingReport,
  reportFeedback,
  reportFeedbackIsError = false,
  onSubmitReport,
}: CommunityReportsSectionProps) {
  const [customAreaLabel, setCustomAreaLabel] = useState<string | null>(null);
  const areaLabel = customAreaLabel ?? defaultAreaLabel;
  const [category, setCategory] = useState<CommunityReport['category']>('tip');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await onSubmitReport({
      areaLabel: areaLabel.trim(),
      category,
      title: title.trim(),
      description: description.trim(),
    });
    if (ok) {
      setTitle('');
      setDescription('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <section
        aria-labelledby="share-tip-heading"
        className="lg:col-span-5 rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
      >
        <div>
          <h2 id="share-tip-heading" className="text-base font-semibold text-[#20332B]">
            Share a Clean-Air Tip or Local Initiative
          </h2>
          <p className="text-xs text-[#52645A] mt-0.5">
            Protect privacy: enter only a general city or district name — never share home
            street addresses or personal contact details.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="comm-area"
                className="block text-xs font-medium text-[#20332B] mb-1"
              >
                General area / city
              </label>
              <input
                id="comm-area"
                type="text"
                required
                minLength={2}
                maxLength={60}
                value={areaLabel}
                onChange={(e) => setCustomAreaLabel(e.target.value)}
                placeholder="e.g., South Delhi"
                className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B]"
              />
            </div>
            <div>
              <label
                htmlFor="comm-cat"
                className="block text-xs font-medium text-[#20332B] mb-1"
              >
                Type
              </label>
              <select
                id="comm-cat"
                value={category}
                onChange={(e) => {
                  if (isOneOf(e.target.value, REPORT_CATEGORIES)) {
                    setCategory(e.target.value);
                  }
                }}
                className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B]"
              >
                <option value="tip">Community Tip</option>
                <option value="initiative">Local Initiative</option>
                <option value="observation">Air Observation</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="comm-title"
              className="block text-xs font-medium text-[#20332B] mb-1"
            >
              Title
            </label>
            <input
              id="comm-title"
              type="text"
              required
              minLength={4}
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Resident leaf composting drive"
              className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B]"
            />
          </div>

          <div>
            <label
              htmlFor="comm-desc"
              className="block text-xs font-medium text-[#20332B] mb-1"
            >
              Details
            </label>
            <textarea
              id="comm-desc"
              rows={3}
              required
              minLength={10}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Share practical steps or local clean-air observations..."
              className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B]"
            />
          </div>

          <button
            type="submit"
            disabled={submittingReport}
            className="w-full rounded-lg bg-[#18543F] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#237A57] disabled:opacity-50 transition-colors"
          >
            {submittingReport ? 'Publishing...' : 'Post to Community Feed'}
          </button>

          {reportFeedback && (
            <p
              role={reportFeedbackIsError ? 'alert' : 'status'}
              className={`text-xs ${
                reportFeedbackIsError ? 'text-[#962D32]' : 'text-[#237A57]'
              }`}
            >
              {reportFeedback}
            </p>
          )}
        </form>
      </section>

      <section
        aria-labelledby="comm-feed-heading"
        className="lg:col-span-7 rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="comm-feed-heading" className="text-base font-semibold text-[#20332B]">
            Community Tips &amp; Local Reports ({reports.length})
          </h2>
          <span className="text-xs text-[#52645A]">
            User-submitted items are clearly marked unverified
          </span>
        </div>

        {reports.length === 0 ? (
          <p className="text-sm text-[#52645A] py-4">
            No community posts yet. Share the first clean-air tip or neighborhood
            initiative from the form on the left.
          </p>
        ) : (
          <ul className="divide-y divide-[#E1EAE4]">
            {reports.map((rep) => (
              <li key={rep.id} className="py-4 first:pt-0 last:pb-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#52645A]">
                  <span className="font-medium text-[#20332B]">{rep.areaLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{rep.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>Unverified user submission</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {formatReadableTimestamp(rep.createdAt)}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[#20332B]">{rep.title}</h3>
                <p className="text-sm text-[#52645A] leading-relaxed">
                  {rep.description}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
