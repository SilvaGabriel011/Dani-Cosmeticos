'use client'

import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  CartesianGrid,
} from 'recharts'

import { useChartContext } from '@/components/ui/chart-container'
import { CHART_COLORS } from '@/lib/chart-colors'
import { formatCurrency } from '@/lib/utils'

interface BarChartData {
  name: string
  value: number
  [key: string]: string | number
}

interface BarChartProps {
  data: BarChartData[]
  dataKey?: string | string[]
  showLegend?: boolean
  showValues?: boolean
  horizontal?: boolean
  height?: number
  valueFormatter?: (value: number) => string
}

export function BarChart({
  data,
  dataKey = 'value',
  showLegend: showLegendProp,
  showValues: showValuesProp,
  horizontal = false,
  height = 300,
  valueFormatter = formatCurrency,
}: BarChartProps) {
  const ctx = useChartContext()
  const showLegend = showLegendProp ?? ctx.showLegend
  const showValues = showValuesProp ?? ctx.showValues
  const keys = Array.isArray(dataKey) ? dataKey : [dataKey]

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
        Sem dados para exibir
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBar
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        {horizontal ? (
          <>
            <XAxis type="number" tickFormatter={(v) => valueFormatter(v)} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => valueFormatter(v)} tick={{ fontSize: 11 }} />
          </>
        )}
        <Tooltip
          formatter={(value) => valueFormatter(Number(value))}
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
        />
        {showLegend && keys.length > 1 && <Legend />}
        {keys.map((key, i) => (
          <Bar key={key} dataKey={key} fill={CHART_COLORS[i]} radius={[4, 4, 0, 0]}>
            {showValues && (
              <LabelList
                dataKey={key}
                position={horizontal ? 'right' : 'top'}
                formatter={(v) => valueFormatter(Number(v))}
                fontSize={10}
              />
            )}
          </Bar>
        ))}
      </RechartsBar>
    </ResponsiveContainer>
  )
}

export type { BarChartData, BarChartProps }
