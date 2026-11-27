import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface ForecastChartPoint {
  isoTime: string;
  time: string;
  aqi: number | null;
  pm25: number | null;
}

interface ForecastAreaChartProps {
  chartData: ForecastChartPoint[];
}

export function ForecastAreaChart({ chartData }: ForecastAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="aqiAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#237A57" stopOpacity={0.22} />
            <stop offset="95%" stopColor="#237A57" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E1EAE4" />
        <XAxis dataKey="time" tick={{ fill: '#52645A', fontSize: 12 }} tickLine={false} />
        <YAxis tick={{ fill: '#52645A', fontSize: 12 }} tickLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#FFFFFF',
            borderColor: '#E1EAE4',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Area
          type="monotone"
          dataKey="aqi"
          name="Forecast AQI"
          stroke="#237A57"
          strokeWidth={2}
          fill="url(#aqiAreaFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
