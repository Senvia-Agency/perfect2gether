import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface DonutChartProps {
  value: number;
  maxValue?: number;
  color?: string;
  backgroundColor?: string;
  size?: number;
}

export function DonutChart({ 
  value, 
  maxValue = 100, 
  color = "hsl(var(--primary))",
  backgroundColor = "hsl(var(--muted))",
  size = 80 
}: DonutChartProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const data = [
    { value: percentage },
    { value: 100 - percentage },
  ];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill={backgroundColor} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-foreground">
          {Math.round(value)}%
        </span>
      </div>
    </div>
  );
}
