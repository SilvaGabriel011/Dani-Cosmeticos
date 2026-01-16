"use client"

import {
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import { CHART_COLORS } from "@/lib/chart-colors"
import { formatCurrency } from "@/lib/utils"
import { useChartContext } from "@/components/ui/chart-container"

interface LineChartData {
  name: string
  [key: string]: string | number
}

interface LineConfig {
  dataKey: string
  name: string
  color?: string
}

interface LineChartProps {
  data: LineChartData[]
  lines: LineConfig[]
  showLegend?: boolean
  showValues?: boolean
  height?: number
  valueFormatter?: (value: number) => string
}

export function LineChart({
  data,
  lines,
  showLegend: showLegendProp,
  showValues: showValuesProp,
  height = 300,
  valueFormatter = formatCurrency,
}: LineChartProps) {
  const ctx = useChartContext()
  const showLegend = showLegendProp ?? ctx.showLegend
  const showValues = showValuesProp ?? ctx.showValues

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
        Sem dados para exibir
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLine
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => valueFormatter(v)} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => valueFormatter(Number(value))}
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
          }}
        />
        {showLegend && <Legend />}
        {lines.map((line, i) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name}
            stroke={line.color || CHART_COLORS[i]}
            strokeWidth={2}
            dot={showValues}
            activeDot={{ r: 6 }}
          />
        ))}
      </RechartsLine>
    </ResponsiveContainer>
  )
}

export type { LineChartData, LineConfig, LineChartProps }
