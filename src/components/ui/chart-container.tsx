'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Toggle } from '@/components/ui/toggle'
import { cn } from '@/lib/utils'

interface ChartContextValue {
  showLegend: boolean
  showValues: boolean
}

const ChartContext = createContext<ChartContextValue>({
  showLegend: true,
  showValues: false,
})

export const useChartContext = () => useContext(ChartContext)

interface ChartContainerProps {
  title: string
  children: ReactNode
  showLegendToggle?: boolean
  showValuesToggle?: boolean
  onLegendChange?: (show: boolean) => void
  onValuesChange?: (show: boolean) => void
  className?: string
}

export function ChartContainer({
  title,
  children,
  showLegendToggle = true,
  showValuesToggle = true,
  onLegendChange,
  onValuesChange,
  className,
}: ChartContainerProps) {
  const [showLegend, setShowLegend] = useState(true)
  const [showValues, setShowValues] = useState(false)

  return (
    <ChartContext.Provider value={{ showLegend, showValues }}>
      <Card className={cn(className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          <div className="flex gap-1">
            {showLegendToggle && (
              <Toggle
                size="sm"
                pressed={showLegend}
                onPressedChange={(v) => {
                  setShowLegend(v)
                  onLegendChange?.(v)
                }}
                className="text-xs"
              >
                Legenda
              </Toggle>
            )}
            {showValuesToggle && (
              <Toggle
                size="sm"
                pressed={showValues}
                onPressedChange={(v) => {
                  setShowValues(v)
                  onValuesChange?.(v)
                }}
                className="text-xs"
              >
                Valores
              </Toggle>
            )}
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </ChartContext.Provider>
  )
}
