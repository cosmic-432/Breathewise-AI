import { memo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  OctagonAlert,
  ShieldAlert,
} from 'lucide-react';
import type { AqiScale } from '../types/index.ts';
import { interpretAqi } from '../utils/aqi.ts';

interface AqiStatusIndicatorProps {
  aqi: number | null | undefined;
  scale?: AqiScale;
  compact?: boolean;
}

/**
 * Accessible, color-independent AQI status indicator.
 * Always communicates severity via icon shape, explicit category label, and risk tier text
 * rather than relying on color alone (WCAG 2.2 AA).
 */
export const AqiStatusIndicator = memo(function AqiStatusIndicator({
  aqi,
  scale = 'US_EPA',
  compact = false,
}: AqiStatusIndicatorProps) {
  const info = interpretAqi(aqi, scale);

  const renderIcon = () => {
    const props = {
      className: 'w-4 h-4 shrink-0',
      style: { color: info.hexColor },
      'aria-hidden': true as const,
    };
    switch (info.id) {
      case 'good':
        return <CheckCircle2 {...props} />;
      case 'moderate':
        return <Info {...props} />;
      case 'sensitive':
        return <AlertTriangle {...props} />;
      case 'unhealthy':
      case 'very_unhealthy':
        return <ShieldAlert {...props} />;
      case 'hazardous':
        return <OctagonAlert {...props} />;
      default:
        return <HelpCircle {...props} />;
    }
  };

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#20332B]">
        {renderIcon()}
        <span>{info.label}</span>
        <span className="text-[#52645A] font-normal">· {info.riskLevel} risk</span>
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {renderIcon()}
      <span className="font-semibold text-[#20332B]">{info.label}</span>
      <span aria-hidden="true" className="text-[#52645A]">
        ·
      </span>
      <span className={`font-medium ${info.textClass}`}>{info.shortTier}</span>
    </div>
  );
});
