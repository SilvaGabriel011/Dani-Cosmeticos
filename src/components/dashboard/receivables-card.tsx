'use client'

import { type Receivable, type Sale, type Client } from '@prisma/client'
import { AlertCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useReceivablesDashboard } from '@/hooks/use-receivables'
import { formatCurrency, formatDate } from '@/lib/utils'


type ReceivableWithSale = Receivable & {
  sale: Sale & { client: Client | null }
}

interface ReceivablesCardProps {
  startDate: string
  endDate: string
}

export function ReceivablesCard({ startDate, endDate }: ReceivablesCardProps) {
  const { data, isLoading } = useReceivablesDashboard({ startDate, endDate })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            Contas a Receber
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[180px]" />
        </CardContent>
      </Card>
    )
  }

  const totalDue = data?.totalDue || 0
  const totalOverdue = data?.totalOverdue || 0
  const receivables = data?.receivables || []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-orange-500" />
          Contas a Receber
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 space-y-1">
          <p className="text-2xl font-bold">{formatCurrency(totalDue)}</p>
          <p className="text-sm text-muted-foreground">
            {data?.pendingCount || 0} parcelas pendentes
          </p>
          {totalOverdue > 0 && (
            <p className="text-sm text-destructive">
              {formatCurrency(totalOverdue)} vencido ({data?.overdueCount || 0} parcelas)
            </p>
          )}
        </div>

        {receivables.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta a receber no período.</p>
        ) : (
          <div className="space-y-3 max-h-[200px] overflow-y-auto">
            {(receivables as ReceivableWithSale[]).slice(0, 5).map((receivable) => {
              const remaining = Number(receivable.amount) - Number(receivable.paidAmount)
              const isOverdue =
                new Date(receivable.dueDate) < new Date() && receivable.status !== 'PAID'

              return (
                <div key={receivable.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">
                      {receivable.sale?.client?.name || 'Cliente não informado'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vence: {formatDate(new Date(receivable.dueDate))}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="font-medium">{formatCurrency(remaining)}</span>
                    {isOverdue && (
                      <Badge variant="destructive" className="text-xs">
                        Vencido
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
