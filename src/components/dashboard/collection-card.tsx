'use client'

import { Wallet, TrendingUp, TrendingDown, Minus } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCollection } from '@/hooks/use-reports'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface CollectionCardProps {
  period?: 'today' | 'week' | 'biweekly' | 'month'
  className?: string
}

export function CollectionCard({ period = 'month', className }: CollectionCardProps) {
  const { data, isLoading } = useCollection({ period })

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Arrecadação</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
        </CardContent>
      </Card>
    )
  }

  const trend = data?.comparison.trend
  const change = data?.comparison.change || 0

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor =
    trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'

  const periodLabel = {
    today: 'hoje',
    week: 'esta semana',
    biweekly: 'últimos 15 dias',
    month: 'este mês',
  }[period]

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Arrecadação</CardTitle>
        <Wallet className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatCurrency(data?.totalCollection || 0)}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>
            {data?.paymentCount || 0} pagamentos {periodLabel}
          </span>
        </div>
        {change !== 0 && (
          <div className={cn('flex items-center gap-1 text-xs mt-1', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            <span>
              {change > 0 ? '+' : ''}
              {change.toFixed(1)}% vs período anterior
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
