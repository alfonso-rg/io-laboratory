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
import { RoundResult, NashEquilibrium, NPolyEquilibrium, FIRM_COLORS } from '../../types/game';

interface QuantityChartProps {
  rounds: RoundResult[];
  nashEquilibrium: NashEquilibrium;
  nPolyEquilibrium?: NPolyEquilibrium;
  numFirms?: number;
  competitionMode?: 'cournot' | 'bertrand';
}

export function QuantityChart({
  rounds,
  nashEquilibrium,
  nPolyEquilibrium,
  numFirms = 2,
  competitionMode = 'cournot',
}: QuantityChartProps) {
  const isBertrand = competitionMode === 'bertrand';

  // Build chart data dynamically for N firms
  const chartData = rounds.map((round) => {
    const data: Record<string, number | string> = {
      round: round.roundNumber,
    };

    for (let i = 0; i < numFirms; i++) {
      const firmId = i + 1;
      const firmResult = round.firmResults?.find(f => f.firmId === firmId);

      const value = isBertrand
        ? (firmResult?.price ?? round.marketPrices?.[i] ?? round.marketPrice)
        : (firmResult?.quantity ?? (firmId === 1 ? round.firm1Quantity : firmId === 2 ? round.firm2Quantity : 0));

      data[`Firm ${firmId}`] = value;
    }

    data['Total'] = round.totalQuantity;
    data['Avg Price'] = round.marketPrice;

    return data;
  });

  // Get Nash quantities for reference lines
  const nashQuantities: number[] = [];
  for (let i = 0; i < numFirms; i++) {
    const firmId = i + 1;
    const nashFirm = nPolyEquilibrium?.firms.find(f => f.firmId === firmId);
    const value = isBertrand
      ? (nashFirm?.price ?? nPolyEquilibrium?.avgMarketPrice ?? nashEquilibrium.marketPrice)
      : (nashFirm?.quantity ?? (firmId === 1 ? nashEquilibrium.firm1Quantity : firmId === 2 ? nashEquilibrium.firm2Quantity : 0));
    nashQuantities.push(value);
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="round" label={{ value: 'Round', position: 'bottom', offset: -5 }} />
        <YAxis label={{ value: isBertrand ? 'Price' : 'Quantity', angle: -90, position: 'insideLeft' }} />
        <Tooltip
          formatter={(value: number) => value.toFixed(2)}
          labelFormatter={(label) => `Round ${label}`}
        />
        <Legend />

        {/* Nash equilibrium reference lines for each firm */}
        {nashQuantities.map((nashQty, i) => (
          <ReferenceLine
            key={`nash-ref-${i}`}
            y={nashQty}
            stroke={FIRM_COLORS[i]}
            strokeDasharray="5 5"
            strokeOpacity={0.4}
          />
        ))}

        {/* Dynamic lines for each firm */}
        {Array.from({ length: numFirms }, (_, i) => (
          <Line
            key={`firm-${i + 1}`}
            type="monotone"
            dataKey={`Firm ${i + 1}`}
            stroke={FIRM_COLORS[i]}
            strokeWidth={2}
            dot={{ fill: FIRM_COLORS[i] }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
