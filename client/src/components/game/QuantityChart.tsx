import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { RoundResult, NashEquilibrium } from '../../types/game';

interface QuantityChartProps {
  rounds: RoundResult[];
  nashEquilibrium: NashEquilibrium;
}

export function QuantityChart({ rounds, nashEquilibrium }: QuantityChartProps) {
  const chartData = rounds.map((round) => ({
    round: round.roundNumber,
    'Firm 1': round.firm1Quantity,
    'Firm 2': round.firm2Quantity,
    'Total': round.totalQuantity,
    'Price': round.marketPrice,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="round" label={{ value: 'Round', position: 'bottom', offset: -5 }} />
        <YAxis label={{ value: 'Quantity', angle: -90, position: 'insideLeft' }} />
        <Tooltip
          formatter={(value: number) => value.toFixed(2)}
          labelFormatter={(label) => `Round ${label}`}
        />
        <Legend />

        {/* Nash equilibrium reference lines */}
        <ReferenceLine
          y={nashEquilibrium.firm1Quantity}
          stroke="#3b82f6"
          strokeDasharray="5 5"
          strokeOpacity={0.5}
        />
        <ReferenceLine
          y={nashEquilibrium.firm2Quantity}
          stroke="#ef4444"
          strokeDasharray="5 5"
          strokeOpacity={0.5}
        />

        <Line
          type="monotone"
          dataKey="Firm 1"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: '#3b82f6' }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="Firm 2"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ fill: '#ef4444' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
