import { Suspense, lazy, useRef, useState } from 'react';
import { MapPin, Menu, X } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { LocationSelectorModal } from './components/LocationSelectorModal.tsx';
import { NAV_ITEMS, SidebarNav } from './components/SidebarNav.tsx';
import { useBreatheWiseState } from './hooks/useBreatheWiseState.ts';
import { useFocusTrap } from './hooks/useFocusTrap.ts';
import { OverviewPage } from './pages/OverviewPage.tsx';
import type { NavSection } from './types/index.ts';
import { interpretAqi } from './utils/aqi.ts';

// Lazy-load secondary views for fast initial load and optimal bundle splitting
const AssistantPage = lazy(() =>
  import('./pages/AssistantPage.tsx').then((m) => ({ default: m.AssistantPage })),
);
const MapPage = lazy(() =>
  import('./pages/MapPage.tsx').then((m) => ({ default: m.MapPage })),
);
const PlannerPage = lazy(() =>
  import('./pages/PlannerPage.tsx').then((m) => ({ default: m.PlannerPage })),
);
const IndoorAirPage = lazy(() =>
  import('./pages/IndoorAirPage.tsx').then((m) => ({ default: m.IndoorAirPage })),
);
const FamilyProtectionPage = lazy(() =>
  import('./pages/FamilyProtectionPage.tsx').then((m) => ({
    default: m.FamilyProtectionPage,
  })),
);
const SustainableChoicesPage = lazy(() =>
  import('./pages/SustainableChoicesPage.tsx').then((m) => ({
    default: m.SustainableChoicesPage,
  })),
);
const ImpactCalculatorPage = lazy(() =>
  import('./pages/ImpactCalculatorPage.tsx').then((m) => ({
    default: m.ImpactCalculatorPage,
  })),
);
const CommunityPage = lazy(() =>
  import('./pages/CommunityPage.tsx').then((m) => ({ default: m.CommunityPage })),
);
const HistoryPage = lazy(() =>
  import('./pages/HistoryPage.tsx').then((m) => ({ default: m.HistoryPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage.tsx').then((m) => ({ default: m.SettingsPage })),
);

export default function App() {
  const state = useBreatheWiseState();
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(mobileDrawerRef, mobileMenuOpen, () => setMobileMenuOpen(false));

  const liveAnnouncement = state.snapshot
    ? `Air quality for ${state.location.name}: ${
        state.snapshot.aqi !== null
          ? `AQI ${state.snapshot.aqi}, ${
              interpretAqi(state.snapshot.aqi, state.snapshot.aqiScale).label
            }`
          : 'currently unavailable'
      }.`
    : '';

  const navigate = (section: NavSection) => {
    setActiveSection(section);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeNavLabel =
    NAV_ITEMS.find((item) => item.id === activeSection)?.label ?? 'Overview';

  return (
    <div className="min-h-screen bg-[#F5F8F6] text-[#20332B] flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#18543F] focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to main content
      </a>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Persistent Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-[#E1EAE4] bg-white sticky top-0 h-screen">
        <SidebarNav activeSection={activeSection} onNavigate={navigate} />
      </aside>

      {/* Mobile Slide-Out Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            aria-hidden="true"
            className="fixed inset-0 bg-[#20332B]/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            id="mobile-navigation-drawer"
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="relative z-10 w-72 max-w-[85vw] bg-white h-full border-r border-[#E1EAE4] shadow-xl flex flex-col"
          >
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#52645A] hover:bg-[#F5F8F6]"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
            <SidebarNav activeSection={activeSection} onNavigate={navigate} />
          </div>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Single-Row Top Bar */}
        <header className="sticky top-0 z-30 h-14 border-b border-[#E1EAE4] bg-white/95 backdrop-blur-xs px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#20332B] hover:bg-[#F5F8F6] shrink-0"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-[#52645A] hidden sm:inline whitespace-nowrap">
                BreatheWise AI
              </span>
              <span aria-hidden="true" className="text-[#E1EAE4] hidden sm:inline">
                /
              </span>
              <span className="font-semibold text-[#20332B] truncate">
                {activeNavLabel}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLocationModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E1EAE4] bg-[#F5F8F6] px-3.5 py-1.5 text-xs font-medium text-[#20332B] hover:bg-[#DDF1E6]/60 transition-colors whitespace-nowrap shrink-0 max-w-[220px]"
          >
            <MapPin className="w-3.5 h-3.5 text-[#237A57] shrink-0" aria-hidden="true" />
            <span className="truncate">{state.location.name}</span>
          </button>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 focus:outline-none"
        >
          <ErrorBoundary key={activeSection}>
            <Suspense
              fallback={
                <div className="rounded-xl border border-[#E1EAE4] bg-white p-8 text-sm text-[#52645A]">
                  Loading section...
                </div>
              }
            >
              {activeSection === 'overview' && (
                <OverviewPage
                  state={state}
                  onNavigate={navigate}
                  onOpenLocationModal={() => setLocationModalOpen(true)}
                />
              )}
              {activeSection === 'assistant' && (
                <AssistantPage
                  state={state}
                  onOpenLocationModal={() => setLocationModalOpen(true)}
                />
              )}
              {activeSection === 'map' && (
                <MapPage
                  state={state}
                  onOpenLocationModal={() => setLocationModalOpen(true)}
                />
              )}
              {activeSection === 'planner' && <PlannerPage state={state} />}
              {activeSection === 'indoor' && <IndoorAirPage state={state} />}
              {activeSection === 'family' && <FamilyProtectionPage state={state} />}
              {activeSection === 'sustainable' && (
                <SustainableChoicesPage state={state} onNavigate={navigate} />
              )}
              {activeSection === 'impact' && <ImpactCalculatorPage state={state} />}
              {activeSection === 'community' && <CommunityPage state={state} />}
              {activeSection === 'history' && <HistoryPage state={state} />}
              {activeSection === 'settings' && (
                <SettingsPage
                  state={state}
                  onOpenLocationModal={() => setLocationModalOpen(true)}
                />
              )}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <LocationSelectorModal
        isOpen={locationModalOpen}
        currentLocation={state.location}
        onSelect={state.setLocation}
        onClose={() => setLocationModalOpen(false)}
      />
    </div>
  );
}
