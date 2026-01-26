'use client'

import { PieChart as RechartsPie, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'

import { useChartContext } from '@/components/ui/chart-container'
import { CHART_COLORS } from '@/lib/chart-colors'
import { formatCurrency } from '@/lib/utils'

interface PieChartData {
  name: string
  value: number
  color?: string
  [key: string]: string | number | undefined
}

interface PieChartProps {
  data: PieChartData[]
  showLegend?: boolean
  showValues?: boolean
  donut?: boolean
  height?: number
  valueFormatter?: (value: number) => string
}

export function PieChart({
  data,
  showLegend: showLegendProp,
  showValues: showValuesProp,
  donut = false,
  height = 300,
  valueFormatter = formatCurrency,
}: PieChartProps) {
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
      <RechartsPie>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={donut ? 60 : 0}
          outerRadius={80}
          label={showValues ? ({ value }) => valueFormatter(Number(value)) : undefined}
          labelLine={showValues}
        >
          {data.map((entry, i) => (
            <Cell key={`cell-${i}`} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => valueFormatter(Number(value))}
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
        />
        {showLegend && <Legend />}
      </RechartsPie>
    </ResponsiveContainer>
  )
}

export type { PieChartData, PieChartProps }
