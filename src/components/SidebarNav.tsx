import {
  Activity,
  BarChart3,
  Bot,
  CalendarClock,
  HeartHandshake,
  Home,
  Leaf,
  Map as MapIcon,
  Settings,
  ShieldCheck,
  Users,
  Wind,
} from 'lucide-react';
import type { NavSection } from '../types/index.ts';

export const NAV_ITEMS: ReadonlyArray<{
  id: NavSection;
  label: string;
  icon: typeof Activity;
}> = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'assistant', label: 'AI Air Assistant', icon: Bot },
  { id: 'map', label: 'Air Quality Map', icon: MapIcon },
  { id: 'planner', label: 'Daily Planner', icon: CalendarClock },
  { id: 'indoor', label: 'Indoor Air', icon: Home },
  { id: 'family', label: 'Family Protection', icon: ShieldCheck },
  { id: 'sustainable', label: 'Sustainable Choices', icon: Leaf },
  { id: 'impact', label: 'My Impact', icon: BarChart3 },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'history', label: 'Air Quality History', icon: HeartHandshake },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarNavProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
}

export function SidebarNav({ activeSection, onNavigate }: SidebarNavProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5 border-b border-[#E1EAE4]">
        <button
          type="button"
          onClick={() => onNavigate('overview')}
          className="flex items-center gap-2.5 text-left"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#237A57] text-white shrink-0">
            <Wind className="w-4 h-4" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight text-[#20332B] font-display whitespace-nowrap">
            BreatheWise AI
          </span>
        </button>
      </div>

      <div className="px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={() => onNavigate('assistant')}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#237A57] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#18543F] transition-colors whitespace-nowrap"
        >
          <Bot className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Ask BreatheWise AI</span>
        </button>
      </div>

      <nav
        aria-label="Primary navigation"
        className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#DDF1E6] text-[#18543F]'
                  : 'text-[#66786E] hover:bg-[#F5F8F6] hover:text-[#20332B]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[#E1EAE4] px-5 py-3.5 text-xs text-[#66786E]">
        Breathe smarter. Live healthier.
      </div>
    </div>
  );
}
