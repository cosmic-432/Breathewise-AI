// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import L from 'leaflet';
import { apiClient, type CommunitySummaryPayload } from '../api/client.ts';
import { ErrorBoundary } from '../components/ErrorBoundary.tsx';
import type { BreatheWiseState } from '../hooks/useBreatheWiseState.ts';
import { resetLocationPresetsCache } from '../hooks/useLocationPresets.ts';
import { AssistantPage } from '../pages/AssistantPage.tsx';
import { CommunityPage } from '../pages/CommunityPage.tsx';
import { FamilyProtectionPage } from '../pages/FamilyProtectionPage.tsx';
import { HistoryPage } from '../pages/HistoryPage.tsx';
import { ImpactCalculatorPage } from '../pages/ImpactCalculatorPage.tsx';
import { IndoorAirPage } from '../pages/IndoorAirPage.tsx';
import { MapPage } from '../pages/MapPage.tsx';
import { SettingsPage } from '../pages/SettingsPage.tsx';
import {
  DEFAULT_CHECKLIST,
  DEFAULT_HOUSEHOLD,
  DEFAULT_INDOOR,
  DEFAULT_LOCATION,
  DEFAULT_ROUTINES,
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
  StructuredAIResponse,
} from '../types/index.ts';

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

const SAMPLE_AI_RESPONSE: StructuredAIResponse = {
  summary: 'Keep windows closed during morning smog peak and use enclosed transit.',
  air_quality_context: {
    location: 'New Delhi, Connaught Place',
    aqi_value: 245,
    aqi_category: 'Poor (CPCB NAQI)',
    data_status: 'Model-estimated',
    data_source: 'Open-Meteo Air Quality',
    last_updated: '2026-11-26T09:00:00.000Z',
  },
  recommendations: [
    {
      title: 'Shift exercise indoors',
      action: 'Move morning cardio indoors while AQI exceeds 200.',
      basis: 'verified_data',
    },
  ],
  indoor_actions: ['Run True HEPA purifier on medium speed.'],
  outdoor_actions: ['Wear a well-fitted N95 mask near busy roads.'],
  sustainable_alternatives: ['Take enclosed metro instead of solo car driving.'],
  impact_explanation: ['Reduces tailpipe PM2.5 near commuters.'],
  limitations: ['Model-estimated values may differ from hyper-local street sensors.'],
  sources: ['Open-Meteo Air Quality (CAMS Atmospheric Model)'],
};

const SAMPLE_COMMUNITY: CommunitySummaryPayload = {
  challenges: [
    {
      id: 'ch-carpool',
      title: 'Shared Commute Week',
      category: 'transport',
      description: 'Coordinate enclosed carpools or transit commutes.',
      goalDescription: 'Log 2 shared trips this week',
      participantsCount: 3,
      actionsLoggedCount: 5,
      verifiedNotice: 'Verified locally on this instance.',
    },
  ],
  reports: [
    {
      id: 'rep-1',
      areaLabel: 'South Delhi',
      category: 'tip',
      title: 'Leaf composting bins',
      description: 'Resident association placed bins to eliminate dry leaf burning.',
      createdAt: '2026-11-26T08:00:00.000Z',
      unverifiedUserReport: true,
    },
  ],
  totalVerifiedParticipants: 3,
  totalLoggedActions: 5,
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

describe('Page-level behavioral, accessibility, state, and error-boundary tests', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetLocationPresetsCache();
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('AssistantPage enforces minimum query length, renders structured h3 headings without skipping h2, handles cancel/error, and clears chat', async () => {
    const user = userEvent.setup();
    const askSpy = vi
      .spyOn(apiClient, 'askAssistant')
      .mockResolvedValueOnce(SAMPLE_AI_RESPONSE)
      .mockRejectedValueOnce(new Error('Gemini rate limit exceeded'));

    function Harness() {
      const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
      return (
        <AssistantPage
          state={buildMockState({ chatTurns, setChatTurns })}
          onOpenLocationModal={vi.fn()}
        />
      );
    }

    const { container } = render(<Harness />);
    const input = screen.getByLabelText(/ask breathewise ai a question/i);
    const submitBtn = screen.getByRole('button', { name: /ask assistant/i });

    expect(submitBtn).toBeDisabled();
    await user.type(input, 'Hi');
    expect(submitBtn).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'Is it safe to commute by metro today?');
    expect(submitBtn).toBeEnabled();
    await user.click(submitBtn);

    expect(
      await screen.findByText(/keep windows closed during morning smog peak/i),
    ).toBeInTheDocument();
    expect(askSpy).toHaveBeenCalledTimes(1);

    // Heading hierarchy must never skip h2 -> h4 inside structured AI responses
    expect(
      screen.getByRole('heading', { level: 2, name: /conversation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: /priority recommendations/i }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('h4')).toHaveLength(0);

    // Error state renders an accessible alert
    await user.type(input, 'What about evening walks?');
    await user.click(submitBtn);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Gemini rate limit exceeded');

    // Clear Chat resets conversation back to example prompts
    await user.click(screen.getByRole('button', { name: /clear chat/i }));
    expect(
      screen.getByRole('heading', { level: 2, name: /ask a question about today/i }),
    ).toBeInTheDocument();
  });

  it('AssistantPage cancels an in-flight AI request cleanly via Cancel button', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'askAssistant').mockImplementation((_payload, signal) => {
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    });

    function Harness() {
      const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
      return (
        <AssistantPage
          state={buildMockState({ chatTurns, setChatTurns })}
          onOpenLocationModal={vi.fn()}
        />
      );
    }

    render(<Harness />);
    await user.type(
      screen.getByLabelText(/ask breathewise ai a question/i),
      'Should children play outdoors?',
    );
    await user.click(screen.getByRole('button', { name: /ask assistant/i }));

    const loadingRow = await screen.findByRole('status');
    expect(loadingRow).toHaveTextContent(/analyzing verified local air quality/i);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ImpactCalculatorPage clamps upper bounds, logs and removes actions, renders accessible table captions/scopes, and supports qualitative actions', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [actions, setActions] = useState<RecordedImpactAction[]>([]);
      return (
        <ImpactCalculatorPage
          state={buildMockState({
            impactActions: actions,
            addImpactAction: (a) => setActions((prev) => [a, ...prev]),
            removeImpactAction: (id) =>
              setActions((prev) => prev.filter((item) => item.id !== id)),
          })}
        />
      );
    }

    render(<Harness />);

    // Upper-bound clamping on distance (max 500)
    const distInput = screen.getByLabelText<HTMLInputElement>(/daily round-trip/i);
    fireEvent.change(distInput, { target: { value: '9999' } });
    expect(distInput.value).toBe('500');

    // Toggle accessible comparison table and verify caption & scope="col"
    await user.click(screen.getByRole('button', { name: /view accessible table/i }));
    const comparisonTable = screen.getByRole('table', {
      name: /before versus after estimated co2 emissions comparison/i,
    });
    const comparisonHeaders = within(comparisonTable).getAllByRole('columnheader');
    comparisonHeaders.forEach((th) => expect(th).toHaveAttribute('scope', 'col'));

    // Log action updates table and live status region
    await user.click(
      screen.getByRole('button', { name: /record action & update my impact/i }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(/sustainable action recorded/i);
    const actionsTable = screen.getByRole('table', {
      name: /recorded sustainable actions/i,
    });
    expect(
      within(actionsTable).getByText(/carpool instead of solo driving/i),
    ).toBeInTheDocument();
    within(actionsTable)
      .getAllByRole('columnheader')
      .forEach((th) => expect(th).toHaveAttribute('scope', 'col'));

    // Remove logged action
    await user.click(
      screen.getByRole('button', { name: /delete logged action carpool/i }),
    );
    expect(screen.getByText(/no actions logged yet/i)).toBeInTheDocument();

    // Switch to electricity reduction and verify upper-bound clamping (max 5000)
    const actionSelect = screen.getByLabelText(/^sustainable action$/i);
    await user.selectOptions(actionSelect, 'electricity_reduction');
    const kwhInput = screen.getByLabelText<HTMLInputElement>(/electricity saved/i);
    fireEvent.change(kwhInput, { target: { value: '99999' } });
    expect(kwhInput.value).toBe('5000');

    // Switch to qualitative action (no fabricated numeric factor)
    await user.selectOptions(actionSelect, 'avoid_waste_burning');
    expect(
      screen.getByText(
        /educational impact assessment \(no fabricated numerical factor\)/i,
      ),
    ).toBeInTheDocument();
  });

  it('IndoorAirPage clamps numeric inputs, warns on ionizer/ozone purifiers, separates sensor PM2.5, and fetches AI guidance', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'askAssistant').mockResolvedValueOnce(SAMPLE_AI_RESPONSE);

    function Harness() {
      const [indoor, setIndoor] = useState<IndoorConditions>(DEFAULT_INDOOR);
      return <IndoorAirPage state={buildMockState({ indoor, setIndoor })} />;
    }

    render(<Harness />);

    // Clamp room size (max 400) and occupants (max 20)
    const roomSizeInput = screen.getByLabelText<HTMLInputElement>(/approx\. room size/i);
    fireEvent.change(roomSizeInput, { target: { value: '999' } });
    expect(roomSizeInput.value).toBe('400');

    const occupantsInput = screen.getByLabelText<HTMLInputElement>(/occupants/i);
    fireEvent.change(occupantsInput, { target: { value: '99' } });
    expect(occupantsInput.value).toBe('20');

    // Clamp optional sensor PM2.5 (max 2000) and humidity (max 100)
    const sensorInput = screen.getByLabelText<HTMLInputElement>(/indoor sensor pm2\.5/i);
    fireEvent.change(sensorInput, { target: { value: '5000' } });
    expect(sensorInput.value).toBe('2000');

    const humidityInput = screen.getByLabelText<HTMLInputElement>(/indoor humidity/i);
    fireEvent.change(humidityInput, { target: { value: '150' } });
    expect(humidityInput.value).toBe('100');

    // Selecting ionizer/ozone triggers accessible safety alert
    await user.click(screen.getByLabelText(/air purifier available in this room/i));
    await user.selectOptions(screen.getByLabelText(/filter type/i), 'ionizer_ozone');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/ozone/i);

    // Request AI indoor guidance
    await user.click(screen.getByRole('button', { name: /get ai indoor plan/i }));
    expect(
      await screen.findByText(/keep windows closed during morning smog peak/i),
    ).toBeInTheDocument();
  });

  it('FamilyProtectionPage toggles household profile, manages checklist items, and generates/dismisses AI brief', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'askAssistant').mockResolvedValueOnce(SAMPLE_AI_RESPONSE);

    function Harness() {
      const [household, setHousehold] = useState<HouseholdProfile>(DEFAULT_HOUSEHOLD);
      const [checklist, setChecklist] =
        useState<FamilyChecklistItem[]>(DEFAULT_CHECKLIST);
      return (
        <FamilyProtectionPage
          state={buildMockState({ household, setHousehold, checklist, setChecklist })}
        />
      );
    }

    render(<Harness />);

    // Toggle household age group checkbox
    const childrenCheckbox = screen.getByLabelText(/children \(under 12\)/i);
    expect(childrenCheckbox).not.toBeChecked();
    await user.click(childrenCheckbox);
    expect(childrenCheckbox).toBeChecked();

    // Add a custom checklist item and toggle its aria-pressed state
    await user.type(
      screen.getByLabelText(/add daily checklist item/i),
      'Pack spare N95 masks in school bag',
    );
    await user.click(screen.getByRole('button', { name: /^add$/i }));
    const customStepBtn = screen.getByRole('button', {
      name: /^pack spare n95 masks in school bag/i,
    });
    expect(customStepBtn).toHaveAttribute('aria-pressed', 'false');
    await user.click(customStepBtn);
    expect(customStepBtn).toHaveAttribute('aria-pressed', 'true');

    // Remove custom item
    await user.click(
      screen.getByRole('button', {
        name: /delete checklist item: pack spare n95 masks in school bag/i,
      }),
    );
    expect(
      screen.queryByRole('button', { name: /^pack spare n95 masks in school bag/i }),
    ).not.toBeInTheDocument();

    // Generate & dismiss AI brief
    await user.click(screen.getByRole('button', { name: /generate ai family brief/i }));
    expect(
      await screen.findByRole('heading', { name: /gemini family protection brief/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(
      screen.queryByRole('heading', { name: /gemini family protection brief/i }),
    ).not.toBeInTheDocument();
  });

  it('CommunityPage loads challenges, participates, posts reports with status/alert roles, isolates AI errors, and syncs defaultAreaLabel without overwriting edits', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'fetchCommunity').mockResolvedValue(SAMPLE_COMMUNITY);
    vi.spyOn(apiClient, 'participateInChallenge').mockResolvedValue({
      challenge: {
        ...SAMPLE_COMMUNITY.challenges[0],
        participantsCount: 4,
        actionsLoggedCount: 6,
      },
      summary: {
        ...SAMPLE_COMMUNITY,
        challenges: [
          {
            ...SAMPLE_COMMUNITY.challenges[0],
            participantsCount: 4,
            actionsLoggedCount: 6,
          },
        ],
        totalVerifiedParticipants: 4,
        totalLoggedActions: 6,
      },
    });
    vi.spyOn(apiClient, 'submitCommunityReport')
      .mockResolvedValueOnce({
        report: {
          id: 'rep-2',
          areaLabel: 'New Delhi',
          category: 'tip',
          title: 'School no-idling signs',
          description: 'Parents agreed to turn off engines during afternoon pickup.',
          createdAt: '2026-11-26T10:00:00.000Z',
          unverifiedUserReport: true,
        },
        summary: {
          ...SAMPLE_COMMUNITY,
          reports: [
            {
              id: 'rep-2',
              areaLabel: 'New Delhi',
              category: 'tip',
              title: 'School no-idling signs',
              description: 'Parents agreed to turn off engines during afternoon pickup.',
              createdAt: '2026-11-26T10:00:00.000Z',
              unverifiedUserReport: true,
            },
            ...SAMPLE_COMMUNITY.reports,
          ],
        },
      })
      .mockRejectedValueOnce(new Error('Report rate limit reached'));
    vi.spyOn(apiClient, 'askAssistant').mockRejectedValueOnce(
      new Error('AI campaign service unavailable'),
    );

    const bengaluru: LocationSelection = {
      ...DEFAULT_LOCATION,
      id: 'in-bengaluru',
      name: 'Bengaluru',
    };

    const { rerender } = render(
      <CommunityPage state={buildMockState({ location: DEFAULT_LOCATION })} />,
    );

    expect(await screen.findByText('Shared Commute Week')).toBeInTheDocument();

    // Area label defaults to current location and syncs when location changes while untouched
    const areaInput = screen.getByLabelText<HTMLInputElement>(/general area \/ city/i);
    expect(areaInput.value).toBe('New Delhi');

    rerender(<CommunityPage state={buildMockState({ location: bengaluru })} />);
    expect(areaInput.value).toBe('Bengaluru');

    // Once user edits area input, subsequent location changes do not overwrite their text
    await user.clear(areaInput);
    await user.type(areaInput, 'Indiranagar');
    rerender(<CommunityPage state={buildMockState({ location: DEFAULT_LOCATION })} />);
    expect(areaInput.value).toBe('Indiranagar');

    // Join challenge updates recorded participant count
    await user.click(screen.getByRole('button', { name: /join voluntarily/i }));
    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    // Submit report -> success uses role="status"
    await user.type(screen.getByLabelText(/^title$/i), 'School no-idling signs');
    await user.type(
      screen.getByLabelText(/^details$/i),
      'Parents agreed to turn off engines during afternoon pickup.',
    );
    await user.click(screen.getByRole('button', { name: /post to community feed/i }));
    const statusMsg = await screen.findByRole('status');
    expect(statusMsg).toHaveTextContent(/posted to the community feed/i);

    // Failed report submission -> error uses role="alert"
    await user.type(screen.getByLabelText(/^title$/i), 'Another neighborhood tip');
    await user.type(
      screen.getByLabelText(/^details$/i),
      'Testing error announcement for community report submissions.',
    );
    await user.click(screen.getByRole('button', { name: /post to community feed/i }));
    const reportAlert = await screen.findByText('Report rate limit reached');
    expect(reportAlert).toHaveAttribute('role', 'alert');

    // AI campaign failure stays inside AiGuidanceCard as an alert without clobbering community state
    await user.click(screen.getByRole('button', { name: /ai campaign idea/i }));
    expect(
      await screen.findByText('AI campaign service unavailable'),
    ).toBeInTheDocument();
  });

  it('HistoryPage renders empty state, single-reading accessible table with caption/scope, and multi-reading toggle', async () => {
    const user = userEvent.setup();
    const reading1: HistoricalAqiRecord = {
      id: 'h-1',
      recordedAt: '2026-11-26T08:00:00.000Z',
      locationId: 'in-delhi-central',
      locationName: 'New Delhi',
      aqi: 245,
      pm25: 103.5,
      pm10: 168,
      no2: 42,
      dataSource: 'Open-Meteo CAMS',
      status: 'estimated',
    };
    const reading2: HistoricalAqiRecord = {
      id: 'h-2',
      recordedAt: '2026-11-26T10:00:00.000Z',
      locationId: 'in-delhi-central',
      locationName: 'New Delhi',
      aqi: 195,
      pm25: 88,
      pm10: 140,
      no2: 35,
      dataSource: 'Open-Meteo CAMS',
      status: 'estimated',
    };

    const { rerender } = render(
      <HistoryPage state={buildMockState({ aqiHistory: [] })} />,
    );
    expect(screen.getByText(/no historical readings stored yet/i)).toBeInTheDocument();

    // 1 reading renders accessible table directly with caption & scope="col"
    rerender(<HistoryPage state={buildMockState({ aqiHistory: [reading1] })} />);
    const table = screen.getByRole('table', {
      name: /retrieved environmental air quality readings history/i,
    });
    within(table)
      .getAllByRole('columnheader')
      .forEach((th) => expect(th).toHaveAttribute('scope', 'col'));

    // >= 2 readings renders trend chart by default and toggles to table cleanly
    rerender(
      <HistoryPage state={buildMockState({ aqiHistory: [reading2, reading1] })} />,
    );
    expect(
      screen.getByRole('img', { name: /line chart of 2 recorded aqi/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /show accessible table/i }));
    expect(
      screen.getByRole('table', {
        name: /retrieved environmental air quality readings history/i,
      }),
    ).toBeInTheDocument();
  });

  it('SettingsPage updates unit & grid preferences and enforces two-step delete confirmation', async () => {
    const user = userEvent.setup();
    const setHousehold = vi.fn();
    const resetAllLocalData = vi.fn();

    render(
      <SettingsPage
        state={buildMockState({ setHousehold, resetAllLocalData })}
        onOpenLocationModal={vi.fn()}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText(/temperature & display units/i),
      'imperial',
    );
    expect(setHousehold).toHaveBeenCalledWith(
      expect.objectContaining({ preferredUnitSystem: 'imperial' }),
    );

    await user.selectOptions(
      screen.getByLabelText(/default electricity grid emission factor/i),
      'us',
    );
    expect(setHousehold).toHaveBeenCalledWith(
      expect.objectContaining({ regionGrid: 'us' }),
    );

    // Two-step delete: Cancel leaves data intact
    await user.click(screen.getByRole('button', { name: /delete all local data/i }));
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(resetAllLocalData).not.toHaveBeenCalled();

    // Two-step delete: Confirm triggers reset and announces status
    await user.click(screen.getByRole('button', { name: /delete all local data/i }));
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));
    expect(resetAllLocalData).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(/permanently deleted/i);
  });

  it('ErrorBoundary catches render failures, renders role=alert fallback, and recovers on Reload Section', async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;

    function FlakyChild() {
      if (shouldThrow) {
        throw new Error('Simulated chart crash');
      }
      return <p>Recovered section content</p>;
    }

    render(
      <ErrorBoundary>
        <FlakyChild />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/unexpected display issue/i);
    expect(screen.queryByText(/simulated chart crash/i)).not.toBeInTheDocument();

    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: /reload section/i }));
    expect(screen.getByText('Recovered section content')).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });

  it('MapPage constructs safe DOM popup nodes without raw HTML injection and marks active location with aria-current', async () => {
    const popupArgs: unknown[] = [];
    const fakeLayer = {
      addTo: vi.fn().mockReturnThis(),
      clearLayers: vi.fn(),
    };
    const fakeMap = {
      setView: vi.fn(),
      on: vi.fn(),
      remove: vi.fn(),
    };
    const fakeMarker = {
      bindPopup: vi.fn((content: unknown) => {
        popupArgs.push(content);
        return fakeMarker;
      }),
      bindTooltip: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
    };

    vi.spyOn(L, 'map').mockReturnValue(fakeMap as unknown as L.Map);
    vi.spyOn(L, 'tileLayer').mockReturnValue({
      addTo: vi.fn(),
    } as unknown as L.TileLayer);
    vi.spyOn(L, 'layerGroup').mockReturnValue(fakeLayer as unknown as L.LayerGroup);
    vi.spyOn(L, 'circleMarker').mockReturnValue(fakeMarker as unknown as L.CircleMarker);

    const xssLocation: LocationSelection = {
      ...DEFAULT_LOCATION,
      name: 'Delhi <img src=x onerror=alert(1)>',
    };
    vi.spyOn(apiClient, 'fetchPresets').mockResolvedValue([xssLocation]);

    render(
      <MapPage
        state={buildMockState({ location: xssLocation })}
        onOpenLocationModal={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('region', { name: /interactive air quality map/i }),
    ).toBeInTheDocument();

    // Verify popup received a safe DOM element with escaped textContent and zero injected <img> nodes
    expect(popupArgs.length).toBeGreaterThanOrEqual(1);
    const popupNode = popupArgs[0];
    expect(popupNode).toBeInstanceOf(HTMLElement);
    const el = popupNode as HTMLElement;
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('Delhi <img src=x onerror=alert(1)>');

    // Verify active preset directory button exposes aria-current="true"
    const activeBtn = await screen.findByRole('button', {
      name: /delhi <img src=x onerror=alert\(1\)>/i,
    });
    expect(activeBtn).toHaveAttribute('aria-current', 'true');
  });
});
