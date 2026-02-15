'use client'

import { type Receivable, type Sale, type Client } from '@prisma/client'
import { type Decimal } from '@prisma/client/runtime/library'
import { CalendarClock } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { usePaySaleReceivables } from '@/hooks/use-receivables'
import { useUpdateReceivable } from '@/hooks/use-sales'
import { useSettings } from '@/hooks/use-settings'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'

type ReceivableWithSale = Receivable & {
  sale: Sale & {
    client: Client | null
    fixedInstallmentAmount?: Decimal | null
  }
}

interface ReceivablePaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  receivable: ReceivableWithSale | null
}

export function ReceivablePaymentModal({
  open,
  onOpenChange,
  receivable,
}: ReceivablePaymentModalProps) {
  const { toast } = useToast()
  const paySaleReceivables = usePaySaleReceivables()
  const updateReceivable = useUpdateReceivable()
  const { data: settings } = useSettings()

  const [mode, setMode] = useState<'pay' | 'reschedule'>('pay')
  const [amount, setAmount] = useState(0)
  const [paidAt, setPaidAt] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'PIX' | 'DEBIT' | 'CREDIT'>('PIX')
  const [rescheduleDays, setRescheduleDays] = useState(7)
  const [creditInstallments, setCreditInstallments] = useState(1)

  const feePercent = useMemo(() => {
    switch (paymentMethod) {
      case 'DEBIT':
        return Number(settings?.debitFeePercent || 1.5)
      case 'CREDIT':
        return creditInstallments > 1
          ? Number(settings?.creditInstallmentFee || 4)
          : Number(settings?.creditFeePercent || 3)
      default:
        return 0
    }
  }, [paymentMethod, creditInstallments, settings])

  const feeAbsorber = settings?.defaultFeeAbsorber || 'SELLER'
  const feeAmount = amount * (feePercent / 100)

  const rescheduleDate = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() + rescheduleDays)
    return date
  }, [rescheduleDays])

  // Pre-fill with today's date and fixed installment amount (or remaining) when modal opens
  useEffect(() => {
    if (open && receivable) {
      const remaining = Number(receivable.amount) - Number(receivable.paidAmount)
      // Use fixedInstallmentAmount if set, but cap at remaining amount
      const fixedAmount = receivable.sale?.fixedInstallmentAmount
        ? Math.min(Number(receivable.sale.fixedInstallmentAmount), remaining)
        : remaining
      setAmount(fixedAmount)
      setPaidAt(new Date().toISOString().split('T')[0])
      setPaymentMethod('PIX')
      setCreditInstallments(1)
      setMode('pay')
      setRescheduleDays(7)
    }
  }, [open, receivable])

  if (!receivable) return null

  const remaining = Number(receivable.amount) - Number(receivable.paidAmount)
  const clientName = receivable.sale?.client?.name || 'Cliente nao informado'

  const handleSubmit = async () => {
    if (amount <= 0) {
      toast({ title: 'Informe um valor valido', variant: 'destructive' })
      return
    }

    try {
      await paySaleReceivables.mutateAsync({
        saleId: receivable.saleId,
        amount,
        paymentMethod,
        paidAt: paidAt ? new Date(paidAt).toISOString() : undefined,
        ...(feePercent > 0 && { feePercent, feeAbsorber }),
        ...(paymentMethod === 'CREDIT' && creditInstallments > 1 && { installments: creditInstallments }),
      })

      toast({
        title: 'Pagamento registrado!',
        description: 'O pagamento foi distribuido entre as parcelas pendentes.',
      })

      onOpenChange(false)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      toast({
        title: 'Erro ao registrar pagamento',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  const handleReschedule = async () => {
    if (rescheduleDays <= 0) {
      toast({ title: 'Informe um numero de dias valido', variant: 'destructive' })
      return
    }

    try {
      await updateReceivable.mutateAsync({
        id: receivable.id,
        dueDate: rescheduleDate.toISOString(),
      })

      toast({
        title: 'Parcela reagendada!',
        description: `Nova data de vencimento: ${formatDate(rescheduleDate)}`,
      })

      onOpenChange(false)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      toast({
        title: 'Erro ao reagendar',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{mode === 'pay' ? 'Adicionar Pagamento' : 'Reagendar Parcela'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toggle Pagar / Reagendar */}
          <div className="flex rounded-lg bg-muted p-1 gap-1">
            <button
              type="button"
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                mode === 'pay'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setMode('pay')}
            >
              Pagar
            </button>
            <button
              type="button"
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'reschedule'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setMode('reschedule')}
            >
              <CalendarClock className="h-4 w-4" />
              Reagendar
            </button>
          </div>

          <div className="rounded-md bg-muted p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Cliente:</span>
              <span className="font-medium">{clientName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Parcela:</span>
              <span>{receivable.installment}a parcela</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Valor da Parcela:</span>
              <span>{formatCurrency(Number(receivable.amount))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Ja Pago:</span>
              <span className="text-green-600 dark:text-green-400">
                {formatCurrency(Number(receivable.paidAmount))}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Saldo Restante:</span>
              <span className="text-amber-600 dark:text-amber-400">{formatCurrency(remaining)}</span>
            </div>
          </div>

          {mode === 'pay' ? (
            <>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={remaining}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(remaining)}
                  >
                    Valor Total
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(Math.round((remaining / 2) * 100) / 100)}
                  >
                    Metade
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data do Pagamento</Label>
                <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {paymentMethod === 'CREDIT' && (
                  <div className="space-y-2">
                    <Label>Parcelas do Cartão</Label>
                    <Select
                      value={String(creditInstallments)}
                      onValueChange={(v) => setCreditInstallments(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n === 1 ? 'À vista' : `${n}x`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {feePercent > 0 && (
                  <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taxa ({feePercent}%):</span>
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        {formatCurrency(feeAmount)}
                      </span>
                    </div>
                    {feeAbsorber === 'SELLER' && (
                      <p className="text-xs text-muted-foreground">
                        Loja recebe: {formatCurrency(amount - feeAmount)}
                      </p>
                    )}
                    {feeAbsorber === 'CLIENT' && (
                      <p className="text-xs text-muted-foreground">
                        Taxa absorvida pelo cliente — processadora desconta do valor pago.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Adiar por quantos dias?</Label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={rescheduleDays}
                  onChange={(e) => setRescheduleDays(Math.max(1, Number(e.target.value)))}
                />
                <div className="flex gap-2">
                  {[7, 15, 30].map((days) => (
                    <Button
                      key={days}
                      type="button"
                      variant={rescheduleDays === days ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRescheduleDays(days)}
                    >
                      {days} dias
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarClock className="h-4 w-4 text-blue-600" />
                  <span className="text-muted-foreground">Nova data de vencimento:</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-400">
                    {formatDate(rescheduleDate)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {mode === 'pay' ? (
            <Button onClick={handleSubmit} disabled={paySaleReceivables.isPending}>
              {paySaleReceivables.isPending ? 'Registrando...' : 'Confirmar'}
            </Button>
          ) : (
            <Button onClick={handleReschedule} disabled={updateReceivable.isPending}>
              {updateReceivable.isPending ? 'Reagendando...' : 'Confirmar Reagendamento'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
