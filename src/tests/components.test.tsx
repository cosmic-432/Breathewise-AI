// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../api/client.ts';
import App from '../App.tsx';
import { LocationSelectorModal } from '../components/LocationSelectorModal.tsx';
import { CurrentAqiHeroCard } from '../components/overview/CurrentAqiHeroCard.tsx';
import { ForecastOutlookCard } from '../components/overview/ForecastOutlookCard.tsx';
import { useAiGuidance } from '../hooks/useAiGuidance.ts';
import {
  useBreatheWiseState,
  type BreatheWiseState,
} from '../hooks/useBreatheWiseState.ts';
import {
  resetLocationPresetsCache,
  useLocationPresets,
} from '../hooks/useLocationPresets.ts';
import { OverviewPage } from '../pages/OverviewPage.tsx';
import { PlannerPage } from '../pages/PlannerPage.tsx';
import { SustainableChoicesPage } from '../pages/SustainableChoicesPage.tsx';
import {
  DEFAULT_CHECKLIST,
  DEFAULT_HOUSEHOLD,
  DEFAULT_INDOOR,
  DEFAULT_LOCATION,
  DEFAULT_ROUTINES,
} from '../storage/localStore.ts';
import type { AirQualitySnapshot, LocationSelection } from '../types/index.ts';
import { REGION_GRID_OPTIONS, REGION_GRID_VALUES } from '../utils/constants.ts';

const PRESET_BENGALURU: LocationSelection = {
  id: 'in-bengaluru',
  name: 'Bengaluru',
  neighborhood: 'Indiranagar',
  region: 'Karnataka',
  country: 'India',
  countryCode: 'IN',
  latitude: 12.9716,
  longitude: 77.5946,
  source: 'preset',
};

const SAMPLE_SNAPSHOT: AirQualitySnapshot = {
  location: DEFAULT_LOCATION,
  aqi: 245,
  aqiScale: 'INDIA_NAQI',
  aqiStatus: 'estimated',
  dominantPollutant: 'PM2.5',
  pollutants: [
    {
      code: 'PM2.5',
      label: 'Fine Particulate Matter',
      value: 103.5,
      unit: 'µg/m³',
      status: 'estimated',
    },
    {
      code: 'PM10',
      label: 'Coarse Particulate Matter',
      value: 168,
      unit: 'µg/m³',
      status: 'estimated',
    },
  ],
  weather: {
    temperatureC: 19.5,
    humidityPercent: 62,
    windSpeedKmh: 6.4,
    status: 'estimated',
    source: 'Open-Meteo Weather Model',
    timestamp: '2026-11-26T09:00:00.000Z',
  },
  hourlyForecast: [
    {
      time: '2026-11-26T10:00:00.000Z',
      aqi: 240,
      pm25: 102,
      pm10: 165,
      status: 'estimated',
    },
    {
      time: '2026-11-26T11:00:00.000Z',
      aqi: 215,
      pm25: 94,
      pm10: 150,
      status: 'estimated',
    },
  ],
  trend: 'improving',
  trendSummary: 'Forecast suggests easing pollution (~25 AQI lower over next 6h).',
  dataSource: 'Open-Meteo Air Quality (CAMS Atmospheric Model)',
  providerId: 'open-meteo-cams',
  lastUpdated: '2026-11-26T09:00:00.000Z',
  fetchedAt: '2026-11-26T09:05:00.000Z',
  cached: false,
  cacheMaxAgeSeconds: 600,
  freshness: 'live',
};

function buildMockState(overrides?: Partial<BreatheWiseState>): BreatheWiseState {
  return {
    location: DEFAULT_LOCATION,
    setLocation: vi.fn(),
    snapshot: SAMPLE_SNAPSHOT,
    loadingAqi: false,
    aqiError: null,
    refreshAirQuality: vi.fn(),
    household: DEFAULT_HOUSEHOLD,
    setHousehold: vi.fn(),
    routines: DEFAULT_ROUTINES,
    setRoutines: vi.fn(),
    indoor: DEFAULT_INDOOR,
    setIndoor: vi.fn(),
    checklist: DEFAULT_CHECKLIST,
    setChecklist: vi.fn(),
    impactActions: [],
    addImpactAction: vi.fn(),
    removeImpactAction: vi.fn(),
    aqiHistory: [],
    chatTurns: [],
    setChatTurns: vi.fn(),
    resetAllLocalData: vi.fn(),
    ...overrides,
  };
}

describe('React UI component, keyboard, focus, and accessibility behaviors', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetLocationPresetsCache();
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('LocationSelectorModal manages focus, has a single close button, supports search & Escape close', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'fetchPresets').mockResolvedValue([
      DEFAULT_LOCATION,
      PRESET_BENGALURU,
    ]);
    const searchSpy = vi
      .spyOn(apiClient, 'searchLocations')
      .mockResolvedValue([PRESET_BENGALURU]);

    const onSelect = vi.fn();
    const onClose = vi.fn();

    // Create a trigger element to verify focus restoration on Escape
    const trigger = document.createElement('button');
    trigger.textContent = 'Open Location';
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <LocationSelectorModal
        isOpen={true}
        currentLocation={DEFAULT_LOCATION}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: /choose your location/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Exactly ONE accessible Close button inside the dialog (no duplicate backdrop button)
    const closeButtons = screen.getAllByRole('button', {
      name: /close location selector/i,
    });
    expect(closeButtons).toHaveLength(1);

    // Search input receives focus automatically when modal opens
    const searchInput = screen.getByLabelText(/search city, town, or district/i);
    expect(document.activeElement).toBe(searchInput);

    // Tab / Shift+Tab wraps focus inside the active dialog boundary
    const closeBtn = closeButtons[0]!;
    closeBtn.focus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(dialog.contains(document.activeElement)).toBe(true);
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled])',
    );
    const lastFocusable = focusables[focusables.length - 1];
    lastFocusable?.focus();
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(closeBtn);
    searchInput.focus();

    // Preset list loads and selecting a preset notifies parent & closes modal
    const bengaluruBtn = await screen.findByRole('button', { name: /bengaluru/i });
    await user.click(bengaluruBtn);
    expect(onSelect).toHaveBeenCalledWith(PRESET_BENGALURU);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Typing triggers debounced search
    await user.type(searchInput, 'Beng');
    await waitFor(
      () => {
        expect(searchSpy).toHaveBeenCalledWith('Beng', expect.any(AbortSignal));
      },
      { timeout: 1500 },
    );

    // Clearing below 2 characters removes search results heading
    await user.clear(searchInput);
    expect(screen.queryByText(/search results/i)).not.toBeInTheDocument();

    // Pressing Escape invokes onClose
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);

    // Closing restores focus back to the opener trigger element
    rerender(
      <LocationSelectorModal
        isOpen={false}
        currentLocation={DEFAULT_LOCATION}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('LocationSelectorModal displays an accessible alert when search fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'fetchPresets').mockResolvedValue([DEFAULT_LOCATION]);
    vi.spyOn(apiClient, 'searchLocations').mockRejectedValue(
      new Error('Geocoding offline'),
    );

    render(
      <LocationSelectorModal
        isOpen={true}
        currentLocation={DEFAULT_LOCATION}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/search city, town, or district/i), 'Mumbai');
    const alert = await screen.findByRole('alert', {}, { timeout: 1500 });
    expect(alert).toHaveTextContent('Geocoding offline');
  });

  it('App mobile navigation drawer traps focus, supports Escape close, restores focus, and navigates', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'fetchAirQuality').mockResolvedValue(SAMPLE_SNAPSHOT);
    vi.spyOn(apiClient, 'fetchPresets').mockResolvedValue([DEFAULT_LOCATION]);

    render(<App />);

    const menuTrigger = screen.getByRole('button', { name: /open navigation menu/i });
    expect(menuTrigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(menuTrigger);
    expect(menuTrigger).toHaveAttribute('aria-expanded', 'true');

    const drawer = screen.getByRole('dialog', { name: /navigation menu/i });
    expect(drawer).toHaveAttribute('aria-modal', 'true');

    // Exactly ONE close button inside the drawer
    expect(
      within(drawer).getAllByRole('button', { name: /close navigation menu/i }),
    ).toHaveLength(1);

    // Focus moved inside the drawer
    expect(drawer.contains(document.activeElement)).toBe(true);

    // Escape closes the drawer and restores focus to menu trigger
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /navigation menu/i })).toBeNull();
    expect(document.activeElement).toBe(menuTrigger);

    // Re-open drawer and navigate to Sustainable Choices
    await user.click(menuTrigger);
    const reopenedDrawer = screen.getByRole('dialog', { name: /navigation menu/i });
    await user.click(
      within(reopenedDrawer).getByRole('button', { name: /sustainable choices/i }),
    );
    expect(
      await screen.findByRole('heading', { name: /sustainable choices/i }),
    ).toBeInTheDocument();
  });

  it('SustainableChoicesPage implements WAI-ARIA tabs with aria-controls, tabpanel, and arrow-key navigation', async () => {
    const user = userEvent.setup();
    const state = buildMockState();

    render(<SustainableChoicesPage state={state} onNavigate={vi.fn()} />);

    const tablist = screen.getByRole('tablist', {
      name: /filter sustainable alternatives by category/i,
    });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(4);

    const [allTab, transportTab, householdTab, communityTab] = tabs;
    expect(allTab).toHaveAttribute('aria-selected', 'true');
    expect(allTab).toHaveAttribute('tabindex', '0');
    expect(allTab).toHaveAttribute('aria-controls', 'sustainable-alternatives-panel');
    expect(transportTab).toHaveAttribute('tabindex', '-1');

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('id', 'sustainable-alternatives-panel');
    expect(panel).toHaveAttribute('aria-labelledby', 'sustainable-tab-all');

    // Focus first tab and use ArrowRight -> Transportation
    allTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(transportTab);
    expect(transportTab).toHaveAttribute('aria-selected', 'true');
    expect(panel).toHaveAttribute('aria-labelledby', 'sustainable-tab-transportation');

    // End -> Community
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(communityTab);
    expect(communityTab).toHaveAttribute('aria-selected', 'true');

    // ArrowLeft -> Household
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(householdTab);
    expect(householdTab).toHaveAttribute('aria-selected', 'true');

    // Home -> All Categories
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(allTab);
    expect(allTab).toHaveAttribute('aria-selected', 'true');
  });

  it('PlannerPage validates routine title with aria-invalid/role=alert and adds a valid activity', async () => {
    const user = userEvent.setup();
    const setRoutines = vi.fn();
    const state = buildMockState({ setRoutines });

    render(<PlannerPage state={state} />);

    // Submit with too-short title triggers accessible validation error
    const titleInput = screen.getByLabelText(/activity name/i);
    await user.type(titleInput, 'A');
    await user.click(screen.getByRole('button', { name: /add to daily plan/i }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/at least 2 characters/i);
    expect(titleInput).toHaveAttribute('aria-invalid', 'true');
    expect(titleInput).toHaveAttribute('aria-describedby', 'routine-form-error');
    expect(setRoutines).not.toHaveBeenCalled();

    // Entering valid title saves the routine
    await user.clear(titleInput);
    await user.type(titleInput, 'Morning Yoga Indoors');
    await user.click(screen.getByRole('button', { name: /add to daily plan/i }));
    expect(setRoutines).toHaveBeenCalledTimes(1);
    const nextRoutines = setRoutines.mock.calls[0]?.[0];
    expect(nextRoutines[nextRoutines.length - 1]?.title).toBe('Morning Yoga Indoors');
  });

  it('useBreatheWiseState handles loading, refresh, error, location updates, and reset', async () => {
    const fetchSpy = vi
      .spyOn(apiClient, 'fetchAirQuality')
      .mockResolvedValueOnce(SAMPLE_SNAPSHOT)
      .mockRejectedValueOnce(new Error('Provider timeout'))
      .mockResolvedValueOnce({ ...SAMPLE_SNAPSHOT, location: PRESET_BENGALURU, aqi: 82 });

    const { result } = renderHook(() => useBreatheWiseState());

    await waitFor(() => {
      expect(result.current.loadingAqi).toBe(false);
    });
    expect(result.current.snapshot?.aqi).toBe(245);
    expect(result.current.aqiError).toBeNull();
    expect(result.current.aqiHistory).toHaveLength(1);

    // Manual refresh passes refresh: true and surfaces error cleanly on failure
    act(() => {
      result.current.refreshAirQuality();
    });
    await waitFor(() => {
      expect(result.current.loadingAqi).toBe(false);
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      DEFAULT_LOCATION,
      expect.objectContaining({ refresh: true }),
    );
    expect(result.current.aqiError).toBe('Provider timeout');

    // Switching location clears previous error and fetches new location snapshot
    act(() => {
      result.current.setLocation(PRESET_BENGALURU);
    });
    await waitFor(() => {
      expect(result.current.loadingAqi).toBe(false);
    });
    expect(result.current.location.id).toBe(PRESET_BENGALURU.id);
    expect(result.current.snapshot?.aqi).toBe(82);
    expect(result.current.aqiError).toBeNull();

    // State setters & resetAllLocalData work cleanly
    act(() => {
      result.current.addImpactAction({
        id: 'imp-test',
        type: 'carpool',
        label: 'Carpool',
        dateIso: '2026-11-26T10:00:00.000Z',
        quantity: 2,
        unit: 'days',
        co2AvoidedKg: 3.1,
        fuelSavedLiters: 1.3,
        tripsReduced: 2,
        kwhSaved: null,
        regionGrid: 'india',
      });
    });
    expect(result.current.impactActions).toHaveLength(1);

    act(() => {
      result.current.removeImpactAction('imp-test');
    });
    expect(result.current.impactActions).toHaveLength(0);

    act(() => {
      result.current.setHousehold({ ...DEFAULT_HOUSEHOLD, memberCount: 6 });
      result.current.setRoutines([]);
      result.current.setIndoor({ ...DEFAULT_INDOOR, roomSizeSqm: 40 });
      result.current.setChecklist([]);
      result.current.setChatTurns([
        {
          id: 'usr-1',
          role: 'user',
          text: 'Hello',
          createdAt: '2026-11-26T10:00:00.000Z',
        },
      ]);
    });
    expect(result.current.household.memberCount).toBe(6);
    expect(result.current.chatTurns).toHaveLength(1);

    vi.spyOn(apiClient, 'fetchAirQuality').mockResolvedValueOnce(SAMPLE_SNAPSHOT);
    act(() => {
      result.current.resetAllLocalData();
    });
    expect(result.current.location).toEqual(DEFAULT_LOCATION);
    expect(result.current.household).toEqual(DEFAULT_HOUSEHOLD);
    expect(result.current.chatTurns).toEqual([]);
    expect(REGION_GRID_OPTIONS).toHaveLength(REGION_GRID_VALUES.length);
  });

  it('OverviewPage renders loading, error, unavailable states, refresh trigger, and accessible forecast table', async () => {
    const user = userEvent.setup();
    const refreshAirQuality = vi.fn();

    // 1. Error + loading state
    const { rerender } = render(
      <OverviewPage
        state={buildMockState({
          loadingAqi: true,
          snapshot: null,
          aqiError: 'Upstream feed unreachable',
          refreshAirQuality,
        })}
        onNavigate={vi.fn()}
        onOpenLocationModal={vi.fn()}
      />,
    );

    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toHaveTextContent('Upstream feed unreachable');
    expect(
      screen.getByRole('button', { name: /refresh air quality readings/i }),
    ).toBeDisabled();

    // 2. Loaded state with forecast accessible table toggle & refresh button
    rerender(
      <OverviewPage
        state={buildMockState({
          loadingAqi: false,
          snapshot: SAMPLE_SNAPSHOT,
          aqiError: null,
          refreshAirQuality,
        })}
        onNavigate={vi.fn()}
        onOpenLocationModal={vi.fn()}
      />,
    );

    const refreshBtn = screen.getByRole('button', {
      name: /refresh air quality readings/i,
    });
    expect(refreshBtn).toBeEnabled();
    await user.click(refreshBtn);
    expect(refreshAirQuality).toHaveBeenCalledTimes(1);

    // Toggle accessible data table and verify caption + scope="col"
    await user.click(screen.getByRole('button', { name: /view accessible data table/i }));
    const forecastTable = screen.getByRole('table', {
      name: /next 18-hour air quality forecast/i,
    });
    expect(forecastTable).toBeInTheDocument();
    within(forecastTable)
      .getAllByRole('columnheader')
      .forEach((th) => expect(th).toHaveAttribute('scope', 'col'));
    expect(screen.getByText('240')).toBeInTheDocument();
  });

  it('LocationSelectorModal handles geolocation success, PERMISSION_DENIED, and unsupported browser states', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'fetchPresets').mockResolvedValue([DEFAULT_LOCATION]);

    const onSelect = vi.fn();
    const onClose = vi.fn();
    const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

    try {
      // 1. Geolocation success
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (success: PositionCallback) => {
            success({
              coords: { latitude: 12.9716, longitude: 77.5946 },
            } as GeolocationPosition);
          },
        },
      });

      const { rerender } = render(
        <LocationSelectorModal
          isOpen={true}
          currentLocation={DEFAULT_LOCATION}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      const presetBtn = await screen.findByRole('button', { name: /new delhi/i });
      expect(presetBtn).toHaveAttribute('aria-pressed', 'true');

      await user.click(
        screen.getByRole('button', { name: /use device location \(optional\)/i }),
      );
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: 12.9716,
          longitude: 77.5946,
          source: 'geolocation',
        }),
      );
      expect(onClose).toHaveBeenCalledTimes(1);

      // 2. Geolocation PERMISSION_DENIED
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (
            _success: PositionCallback,
            errorCb?: PositionErrorCallback,
          ) => {
            errorCb?.({
              code: 1,
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
              message: 'User denied',
            } as GeolocationPositionError);
          },
        },
      });

      rerender(
        <LocationSelectorModal
          isOpen={true}
          currentLocation={DEFAULT_LOCATION}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );
      await user.click(
        screen.getByRole('button', { name: /use device location \(optional\)/i }),
      );
      expect(screen.getByRole('alert')).toHaveTextContent(
        /location permission was declined/i,
      );

      // 3. Geolocation unsupported in browser
      const navRecord = navigator as unknown as Record<string, unknown>;
      delete navRecord.geolocation;
      await user.click(
        screen.getByRole('button', { name: /use device location \(optional\)/i }),
      );
      expect(screen.getByRole('alert')).toHaveTextContent(
        /device geolocation is not supported/i,
      );
    } finally {
      if (originalGeolocation) {
        Object.defineProperty(navigator, 'geolocation', originalGeolocation);
      }
    }
  });

  it('useLocationPresets surfaces fetch failure cleanly as an error string', async () => {
    vi.spyOn(apiClient, 'fetchPresets').mockRejectedValueOnce(
      new Error('Presets endpoint offline'),
    );

    const { result } = renderHook(() => useLocationPresets(true));
    await waitFor(() => {
      expect(result.current.error).toBe('Presets endpoint offline');
    });
    expect(result.current.presets).toEqual([]);
  });

  it('useBreatheWiseState suppresses AbortError when a rapid location change cancels an in-flight fetch', async () => {
    const fetchSpy = vi
      .spyOn(apiClient, 'fetchAirQuality')
      .mockImplementationOnce((_loc, opts) => {
        return new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      })
      .mockResolvedValueOnce({ ...SAMPLE_SNAPSHOT, location: PRESET_BENGALURU, aqi: 74 });

    const { result } = renderHook(() => useBreatheWiseState());

    act(() => {
      result.current.setLocation(PRESET_BENGALURU);
    });

    await waitFor(() => {
      expect(result.current.loadingAqi).toBe(false);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.current.snapshot?.aqi).toBe(74);
    expect(result.current.aqiError).toBeNull();
  });

  it('useAiGuidance handles loading, success, dismiss, error, and aborts in-flight requests on unmount', async () => {
    const abortedSignals: boolean[] = [];
    vi.spyOn(apiClient, 'askAssistant')
      .mockResolvedValueOnce({
        summary: 'Safe afternoon window.',
        air_quality_context: {
          location: 'New Delhi',
          aqi_value: 245,
          aqi_category: 'Poor',
          data_status: 'Estimated',
          data_source: 'Open-Meteo',
          last_updated: '2026-11-26T09:00:00Z',
        },
        recommendations: [],
        indoor_actions: [],
        outdoor_actions: [],
        sustainable_alternatives: [],
        impact_explanation: [],
        limitations: [],
        sources: [],
      })
      .mockRejectedValueOnce(new Error('AI gateway timeout'))
      .mockImplementationOnce((_payload, signal) => {
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            abortedSignals.push(true);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      });

    const { result, unmount } = renderHook(() => useAiGuidance());

    await act(async () => {
      await result.current.requestGuidance(
        { question: 'Test question?', mode: 'routine', snapshot: SAMPLE_SNAPSHOT },
        'Fallback error',
      );
    });
    expect(result.current.response?.summary).toBe('Safe afternoon window.');
    expect(result.current.error).toBeNull();

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.response).toBeNull();

    await act(async () => {
      await result.current.requestGuidance(
        { question: 'Failing question?', mode: 'routine', snapshot: SAMPLE_SNAPSHOT },
        'Fallback error',
      );
    });
    expect(result.current.error).toBe('AI gateway timeout');

    // Start an in-flight request and unmount to verify AbortController cleanup
    act(() => {
      void result.current.requestGuidance(
        { question: 'Pending unmount?', mode: 'routine', snapshot: SAMPLE_SNAPSHOT },
        'Fallback error',
      );
    });
    unmount();
    expect(abortedSignals).toEqual([true]);
  });

  it('CurrentAqiHeroCard uses accessible WCAG AA text classes for Moderate and Sensitive AQI numerals', () => {
    const { rerender } = render(
      <CurrentAqiHeroCard
        snapshot={{ ...SAMPLE_SNAPSHOT, aqi: 75, aqiScale: 'US_EPA' }}
        loading={false}
        location={DEFAULT_LOCATION}
        useImperial={false}
        onNavigate={vi.fn()}
      />,
    );
    const moderateNumeral = screen.getByText('75');
    expect(moderateNumeral).toHaveClass('text-[#255A7D]');
    expect(moderateNumeral.style.color).toBe('');

    rerender(
      <CurrentAqiHeroCard
        snapshot={{ ...SAMPLE_SNAPSHOT, aqi: 135, aqiScale: 'US_EPA' }}
        loading={false}
        location={DEFAULT_LOCATION}
        useImperial={false}
        onNavigate={vi.fn()}
      />,
    );
    const sensitiveNumeral = screen.getByText('135');
    expect(sensitiveNumeral).toHaveClass('text-[#8F5818]');
    expect(sensitiveNumeral.style.color).toBe('');
  });

  it('ForecastOutlookCard resolves the lazy-loaded ForecastAreaChart cleanly without errors', async () => {
    render(
      <ForecastOutlookCard
        locationName="New Delhi"
        hourlyForecast={SAMPLE_SNAPSHOT.hourlyForecast}
      />,
    );

    const chartRegion = screen.getByRole('img', {
      name: /hourly aqi forecast for new delhi, ranging from 215 to 240/i,
    });
    expect(chartRegion).toBeInTheDocument();

    // Wait for lazy ForecastAreaChart chunk to finish loading and replace fallback text
    await waitFor(() => {
      expect(screen.queryByText(/loading forecast chart/i)).not.toBeInTheDocument();
    });
  });
});
