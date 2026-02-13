'use client'

import { type Receivable, type Sale, type Client } from '@prisma/client'
import { CreditCard, DollarSign, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useReceivablesByClient } from '@/hooks/use-receivables'
import { formatCurrency, formatDate } from '@/lib/utils'

import { ReceivablePaymentModal } from '../dashboard/receivable-payment-modal'

type ReceivableWithSale = Receivable & {
  sale: Sale & { client: Client | null }
}

interface ClientReceivablesPopoverProps {
  clientId: string
  clientName: string
}

export function ClientReceivablesPopover({
  clientId,
  clientName,
}: ClientReceivablesPopoverProps) {
  const [open, setOpen] = useState(false)
  const [selectedReceivable, setSelectedReceivable] = useState<ReceivableWithSale | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)

  const { data: receivables, isLoading } = useReceivablesByClient(clientId)

  const pendingReceivables = (receivables as ReceivableWithSale[] | undefined)?.filter(
    (r) => r.status !== 'PAID' && r.status !== 'CANCELLED'
  ) || []

  const totalPending = pendingReceivables.reduce(
    (sum, r) => sum + Number(r.amount) - Number(r.paidAmount),
    0
  )

  const handlePayment = (receivable: ReceivableWithSale) => {
    setSelectedReceivable(receivable)
    setPaymentModalOpen(true)
    setOpen(false)
  }

  if (pendingReceivables.length === 0 && !isLoading) {
    return null
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
            title={`${pendingReceivables.length} conta(s) em aberto`}
          >
            <CreditCard className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <div className="px-4 py-3 border-b">
            <p className="font-semibold text-sm">{clientName}</p>
            {totalPending > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Total em aberto:{' '}
                <span className="font-semibold text-amber-600">
                  {formatCurrency(totalPending)}
                </span>
              </p>
            )}
          </div>

          <div className="max-h-[280px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </div>
            ) : pendingReceivables.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma conta em aberto.
              </p>
            ) : (
              <div className="divide-y">
                {pendingReceivables.map((receivable) => {
                  const remaining = Number(receivable.amount) - Number(receivable.paidAmount)
                  const isOverdue =
                    new Date(receivable.dueDate) < new Date() && receivable.status !== 'PAID'

                  return (
                    <div
                      key={receivable.id}
                      className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                        isOverdue ? 'bg-red-50/60 dark:bg-red-950/20' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {receivable.installment}a parcela
                          </span>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                              Vencida
                            </Badge>
                          )}
                          {receivable.status === 'PARTIAL' && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              Parcial
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Venc: {formatDate(new Date(receivable.dueDate))}</span>
                          <span>·</span>
                          <span className="font-medium text-amber-600">
                            {formatCurrency(remaining)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                        onClick={() => handlePayment(receivable)}
                        title="Registrar pagamento"
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <ReceivablePaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        receivable={selectedReceivable}
      />
    </>
  )
}
