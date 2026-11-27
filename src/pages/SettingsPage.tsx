import { useState } from 'react';
import { Download, MapPin, Trash2 } from 'lucide-react';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import { localStore } from '../storage/localStore.ts';
import type { HouseholdProfile } from '../types/index.ts';

interface SettingsPageProps {
  state: BreatheWiseState;
  onOpenLocationModal: () => void;
}

export function SettingsPage({
  state,
  onOpenLocationModal,
}: SettingsPageProps) {
  const { household, setHousehold, location, resetAllLocalData } = state;
  const [confirmClear, setConfirmClear] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleExport = () => {
    const json = localStore.exportAllUserData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `breathewise-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage('Your local BreatheWise data has been downloaded as JSON.');
  };

  const handleConfirmDelete = () => {
    resetAllLocalData();
    setConfirmClear(false);
    setStatusMessage(
      'All local preferences, routines, history, and chat messages have been permanently deleted from this browser.',
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#20332B]">
          Settings &amp; Privacy
        </h1>
        <p className="text-sm text-[#66786E] mt-1">
          Manage display units, emission factor region, active location, and full control over your stored data.
        </p>
      </div>

      {statusMessage && (
        <div
          role="status"
          className="rounded-xl border border-[#237A57]/30 bg-[#DDF1E6]/60 px-4 py-3 text-sm text-[#18543F]"
        >
          {statusMessage}
        </div>
      )}

      {/* Location & Display Preferences */}
      <section
        aria-labelledby="prefs-heading"
        className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-5"
      >
        <h2
          id="prefs-heading"
          className="text-base font-semibold text-[#20332B]"
        >
          Location &amp; Calculation Preferences
        </h2>

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E1EAE4] pb-4">
          <div>
            <p className="text-sm font-medium text-[#20332B]">Active Location</p>
            <p className="text-xs text-[#66786E] mt-0.5">
              {location.name}
              {location.neighborhood ? ` · ${location.neighborhood}` : ''} ·{' '}
              {location.country}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenLocationModal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E1EAE4] px-3.5 py-2 text-xs font-medium text-[#20332B] hover:bg-[#F5F8F6] transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 text-[#237A57]" aria-hidden="true" />
            <span>Change Location</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="settings-units"
              className="block text-xs font-medium text-[#20332B] mb-1.5"
            >
              Temperature &amp; display units
            </label>
            <select
              id="settings-units"
              value={household.preferredUnitSystem}
              onChange={(e) =>
                setHousehold({
                  ...household,
                  preferredUnitSystem: e.target
                    .value as HouseholdProfile['preferredUnitSystem'],
                })
              }
              className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B]"
            >
              <option value="metric">Metric (°C, km, m²)</option>
              <option value="imperial">Imperial (°F)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="settings-grid"
              className="block text-xs font-medium text-[#20332B] mb-1.5"
            >
              Default electricity grid emission factor
            </label>
            <select
              id="settings-grid"
              value={household.regionGrid}
              onChange={(e) =>
                setHousehold({
                  ...household,
                  regionGrid: e.target.value as HouseholdProfile['regionGrid'],
                })
              }
              className="w-full rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3 py-2 text-sm text-[#20332B]"
            >
              <option value="india">India — CEA v19 (0.727 kg CO2/kWh)</option>
              <option value="global">Global Average — IEA (0.436 kg CO2/kWh)</option>
              <option value="us">United States — EPA eGRID (0.373 kg CO2/kWh)</option>
              <option value="eu">European Union — EEA (0.242 kg CO2/kWh)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Privacy & Data Control */}
      <section
        aria-labelledby="privacy-heading"
        className="rounded-xl border border-[#E1EAE4] bg-white p-6 space-y-4"
      >
        <h2
          id="privacy-heading"
          className="text-base font-semibold text-[#20332B]"
        >
          Privacy, Data Handling &amp; Transparency
        </h2>

        <ul className="space-y-2 text-sm text-[#66786E] list-disc pl-5">
          <li>
            <strong className="text-[#20332B]">Local-first household storage:</strong>{' '}
            Your routines, indoor setup, family preferences, and history snapshots are stored locally in your browser. No account login or personal identity information is required.
          </li>
          <li>
            <strong className="text-[#20332B]">Server-side AI &amp; data proxy:</strong>{' '}
            All Gemini API calls and environmental data lookups happen securely on the server with input validation, rate limiting, and no third-party analytics trackers.
          </li>
          <li>
            <strong className="text-[#20332B]">Location permission is optional:</strong>{' '}
            You can search any city manually without sharing browser GPS coordinates.
          </li>
          <li>
            <strong className="text-[#20332B]">Multi-user scope note:</strong>{' '}
            Because BreatheWise AI uses privacy-first browser storage without user accounts, shared community challenges use anonymous hashed tokens and community reports are visible to visitors of this instance.
          </li>
        </ul>

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#E1EAE4]">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E1EAE4] bg-white px-4 py-2 text-sm font-medium text-[#20332B] hover:bg-[#F5F8F6] transition-colors"
          >
            <Download className="w-4 h-4 text-[#237A57]" aria-hidden="true" />
            <span>Export My Data (JSON)</span>
          </button>

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#C94D53]/40 bg-[#FBECEE] px-4 py-2 text-sm font-medium text-[#962D32] hover:bg-[#F7DCE0] transition-colors"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              <span>Delete All Local Data</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#C94D53]/40 bg-[#FBECEE] px-3.5 py-2 text-xs text-[#962D32]">
              <span className="font-medium">
                Permanently erase all saved routines, history, and preferences?
              </span>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-md bg-[#C94D53] px-3 py-1 font-medium text-white hover:bg-[#a63a3f]"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="rounded-md border border-[#C94D53]/40 bg-white px-3 py-1 font-medium text-[#20332B]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
