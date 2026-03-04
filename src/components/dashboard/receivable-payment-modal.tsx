'use client'

import { type Receivable, type Sale, type Client } from '@prisma/client'
import { type Decimal } from '@prisma/client/runtime/library'
import { CalendarClock, Banknote, QrCode, CreditCard, Smartphone, Loader2, Printer, Copy, Check, MessageCircle } from 'lucide-react'
import { useState, useEffect, useMemo, useRef } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { formatCurrency, formatDate, formatWhatsAppUrl } from '@/lib/utils'

type ReceivableWithSale = Receivable & {
  sale: Sale & {
    client: Client | null
    fixedInstallmentAmount?: Decimal | null
  }
}

interface SaleSummary {
  saleId: string
  clientName: string
  clientPhone: string | null
  totalInstallments: number
  paidInstallments: number
  totalAmount: number
  paidAmount: number
  installmentAmount: number | null
  nextDueDate: Date | null
  isOverdue: boolean
}

interface PaymentReceiptData {
  clientName: string
  clientPhone: string | null
  amountPaid: number
  paymentMethod: string
  paidAt: string
  installmentNumber: number
  totalInstallments: number
  saleTotal: number
  previousPaid: number
  newPaid: number
  newRemaining: number
  feePercent: number
  feeAmount: number
}

interface ReceivablePaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  receivable: ReceivableWithSale | null
  saleSummary?: SaleSummary | null
}

const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
  CASH: <Banknote className="h-4 w-4" />,
  PIX: <QrCode className="h-4 w-4" />,
  DEBIT: <Smartphone className="h-4 w-4" />,
  CREDIT: <CreditCard className="h-4 w-4" />,
}

export function ReceivablePaymentModal({
  open,
  onOpenChange,
  receivable,
  saleSummary,
}: ReceivablePaymentModalProps) {
  const { toast } = useToast()
  const paySaleReceivables = usePaySaleReceivables()
  const updateReceivable = useUpdateReceivable()
  const { data: settings } = useSettings()

  const [mode, setMode] = useState<'pay' | 'reschedule'>('pay')
  const [viewState, setViewState] = useState<'form' | 'receipt'>('form')
  const [amount, setAmount] = useState(0)
  const [paidAt, setPaidAt] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'PIX' | 'DEBIT' | 'CREDIT'>('PIX')
  const [rescheduleDays, setRescheduleDays] = useState(7)
  const [creditInstallments, setCreditInstallments] = useState(1)
  const [receiptData, setReceiptData] = useState<PaymentReceiptData | null>(null)

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

  // Sale-level data (from saleSummary or fallback to receivable)
  const saleTotal = saleSummary?.totalAmount ?? Number(receivable?.sale?.total ?? 0)
  const salePaid = saleSummary?.paidAmount ?? 0
  const saleRemaining = saleTotal - salePaid
  const totalInstallments = saleSummary?.totalInstallments ?? 0
  const paidInstallments = saleSummary?.paidInstallments ?? 0
  const clientName = saleSummary?.clientName ?? receivable?.sale?.client?.name ?? 'Cliente nao informado'
  const clientPhone = saleSummary?.clientPhone ?? receivable?.sale?.client?.phone ?? null
  const isOverdue = saleSummary?.isOverdue ?? false

  // Installment-level data
  const installmentRemaining = receivable ? Number(receivable.amount) - Number(receivable.paidAmount) : 0
  const installmentNumber = receivable?.installment ?? 0

  // Pre-fill when modal opens
  useEffect(() => {
    if (open && receivable) {
      const instRemaining = Number(receivable.amount) - Number(receivable.paidAmount)
      const fixedAmount = receivable.sale?.fixedInstallmentAmount
        ? Math.min(Number(receivable.sale.fixedInstallmentAmount), instRemaining)
        : instRemaining
      setAmount(fixedAmount)
      setPaidAt(new Date().toISOString().split('T')[0])
      setPaymentMethod('PIX')
      setCreditInstallments(1)
      setMode('pay')
      setViewState('form')
      setRescheduleDays(7)
      setReceiptData(null)
    }
  }, [open, receivable])

  if (!receivable) return null

  const progressPercent = saleTotal > 0 ? Math.min((salePaid / saleTotal) * 100, 100) : 0

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

      const fee = feePercent > 0 ? amount * (feePercent / 100) : 0

      setReceiptData({
        clientName,
        clientPhone,
        amountPaid: amount,
        paymentMethod,
        paidAt: paidAt || new Date().toISOString().split('T')[0],
        installmentNumber,
        totalInstallments,
        saleTotal,
        previousPaid: salePaid,
        newPaid: salePaid + amount,
        newRemaining: saleRemaining - amount,
        feePercent,
        feeAmount: fee,
      })

      setViewState('receipt')

      toast({
        title: 'Pagamento registrado!',
        description: `${formatCurrency(amount)} pago via ${PAYMENT_METHOD_LABELS[paymentMethod]}.`,
      })
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

  if (viewState === 'receipt' && receiptData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] md:max-w-md max-h-[90vh] p-0 gap-0 overflow-hidden">
          <PaymentReceiptView data={receiptData} onClose={() => onOpenChange(false)} />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{mode === 'pay' ? 'Registrar Pagamento' : 'Reagendar Parcela'}</span>
            {isOverdue && (
              <span className="text-xs font-medium text-red-600 bg-red-100 dark:bg-red-900/50 px-2.5 py-1 rounded-full">
                Vencido
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client & Sale Summary */}
          <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">{clientName}</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total da conta</span>
                <span className="font-medium">{formatCurrency(saleTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ja pago</span>
                <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(salePaid)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-1.5 border-t border-primary/20">
                <span>Saldo devedor</span>
                <span className="text-amber-600 dark:text-amber-400 text-lg">{formatCurrency(saleRemaining)}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{paidInstallments}/{totalInstallments} parcelas pagas</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
            </div>
          </div>

          {/* Current installment info */}
          {totalInstallments > 0 && (
            <div className="flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold text-sm shrink-0">
                {installmentNumber}a
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Parcela {installmentNumber} de {totalInstallments}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {formatCurrency(Number(receivable.amount))} — restam {formatCurrency(installmentRemaining)}
                </p>
              </div>
              {saleSummary?.nextDueDate && (
                <span className={`text-xs font-medium shrink-0 ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {formatDate(saleSummary.nextDueDate)}
                </span>
              )}
            </div>
          )}

          {mode === 'pay' ? (
            <div className="space-y-4">
              {/* Payment amount */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Valor do pagamento</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="text-lg font-semibold h-12"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(installmentRemaining)}
                    className="flex-1 hover:bg-green-50 dark:hover:bg-green-950/30 hover:text-green-700 hover:border-green-300"
                  >
                    Parcela ({formatCurrency(installmentRemaining)})
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(Math.round(saleRemaining * 100) / 100)}
                    className="flex-1 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-700 hover:border-amber-300"
                  >
                    Tudo ({formatCurrency(saleRemaining)})
                  </Button>
                </div>
              </div>

              {/* Payment method with icons */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Forma de pagamento</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(PAYMENT_METHOD_LABELS) as [string, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPaymentMethod(key as typeof paymentMethod)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        paymentMethod === key
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50'
                      }`}
                    >
                      {PAYMENT_METHOD_ICONS[key]}
                      {label}
                    </button>
                  ))}
                </div>
                {paymentMethod === 'CREDIT' && (
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs text-muted-foreground">Parcelas do cartao</Label>
                    <Select
                      value={String(creditInstallments)}
                      onValueChange={(v) => setCreditInstallments(Number(v))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n === 1 ? 'A vista' : `${n}x`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {feePercent > 0 && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 space-y-1">
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
                        Taxa absorvida pelo cliente.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Payment date */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Data do pagamento</Label>
                <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="h-10" />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode('reschedule')}
                  className="text-muted-foreground hover:text-foreground gap-1.5"
                >
                  <CalendarClock className="h-4 w-4" />
                  Reagendar
                </Button>
                <div className="flex-1" />
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={paySaleReceivables.isPending || amount <= 0}
                  className="min-w-[140px] bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                >
                  {paySaleReceivables.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registrando...
                    </span>
                  ) : (
                    `Pagar ${formatCurrency(amount)}`
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Adiar por quantos dias?</Label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={rescheduleDays}
                  onChange={(e) => setRescheduleDays(Math.max(1, Number(e.target.value)))}
                  className="h-10"
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

              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarClock className="h-4 w-4 text-blue-600" />
                  <span className="text-muted-foreground">Nova data de vencimento:</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-400">
                    {formatDate(rescheduleDate)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode('pay')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Voltar para Pagar
                </Button>
                <div className="flex-1" />
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleReschedule} disabled={updateReceivable.isPending}>
                  {updateReceivable.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Reagendando...
                    </span>
                  ) : 'Confirmar Reagendamento'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Payment Receipt View ────────────────────────────────────────────────────

function formatDateTimeBR(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function PaymentReceiptView({ data, onClose }: { data: PaymentReceiptData; onClose: () => void }) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const methodLabel = PAYMENT_METHOD_LABELS[data.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] || data.paymentMethod
  const paidAtDate = new Date(data.paidAt + 'T12:00:00')

  const buildWhatsAppMessage = (): string => {
    const lines: string[] = []
    lines.push('*DANI COSMETICOS*')
    lines.push('_Comprovante de Pagamento_')
    lines.push(`Data: ${formatDateTimeBR(new Date())}`)
    lines.push(`Cliente: ${data.clientName}`)
    lines.push('')
    lines.push(`*Valor pago: ${formatCurrency(data.amountPaid)}*`)
    lines.push(`Forma: ${methodLabel}`)
    if (data.feePercent > 0) {
      lines.push(`Taxa: ${data.feePercent}% (${formatCurrency(data.feeAmount)})`)
    }
    lines.push(`Data: ${formatDate(paidAtDate)}`)
    lines.push('')
    if (data.totalInstallments > 0) {
      lines.push(`Parcela: ${data.installmentNumber}a de ${data.totalInstallments}`)
    }
    lines.push(`Total da conta: ${formatCurrency(data.saleTotal)}`)
    lines.push(`Total pago: ${formatCurrency(data.newPaid)}`)
    if (data.newRemaining > 0.01) {
      lines.push(`*Saldo restante: ${formatCurrency(data.newRemaining)}*`)
    } else {
      lines.push('*CONTA QUITADA*')
    }
    lines.push('')
    lines.push('_Obrigada pela preferencia!_')
    return lines.join('\n')
  }

  const handleCopy = async () => {
    const message = buildWhatsAppMessage()
    await navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleWhatsApp = () => {
    if (!data.clientPhone) return
    const url = formatWhatsAppUrl(data.clientPhone)
    if (!url) return
    const message = buildWhatsAppMessage()
    window.open(`${url}?text=${encodeURIComponent(message)}`, '_blank')
  }

  const handlePrint = () => {
    const content = receiptRef.current
    if (!content) return

    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (!printWindow) return

    const styles = [
      '* { margin: 0; padding: 0; box-sizing: border-box; }',
      "body { font-family: 'Courier New', monospace; font-size: 12px; padding: 16px; max-width: 320px; margin: 0 auto; }",
      '.text-center { text-align: center; }',
      '.text-right { text-align: right; }',
      '.text-xs { font-size: 12px; }',
      '.text-sm { font-size: 14px; }',
      '.text-base { font-size: 16px; }',
      '.text-lg { font-size: 18px; }',
      '.font-bold { font-weight: bold; }',
      '.font-medium { font-weight: 500; }',
      '.font-semibold { font-weight: 600; }',
      '.mt-1 { margin-top: 4px; }',
      '.mt-2 { margin-top: 8px; }',
      '.mt-3 { margin-top: 12px; }',
      '.mb-1 { margin-bottom: 4px; }',
      '.mb-2 { margin-bottom: 8px; }',
      '.mb-3 { margin-bottom: 12px; }',
      '.my-2 { margin-top: 8px; margin-bottom: 8px; }',
      '.my-3 { margin-top: 12px; margin-bottom: 12px; }',
      '.p-2 { padding: 8px; }',
      '.px-2 { padding-left: 8px; padding-right: 8px; }',
      '.py-1 { padding-top: 4px; padding-bottom: 4px; }',
      '.space-y-1 > * + * { margin-top: 4px; }',
      '.space-y-2 > * + * { margin-top: 8px; }',
      '.flex { display: flex; }',
      '.justify-between { justify-content: space-between; }',
      '.items-center { align-items: center; }',
      '.gap-1 { gap: 4px; }',
      '.inline-block { display: inline-block; }',
      '.rounded { border-radius: 4px; }',
      '.border-t { border-top: 1px solid; }',
      '.border-dashed { border-style: dashed; }',
      '.border-gray-400 { border-color: #9ca3af; }',
      '.text-gray-400 { color: #9ca3af; }',
      '.text-gray-500 { color: #6b7280; }',
      '.text-green-700 { color: #15803d; }',
      '.text-green-800 { color: #166534; }',
      '.text-amber-700 { color: #b45309; }',
      '.bg-green-100 { background: #dcfce7; }',
      '.bg-amber-100 { background: #fef3c7; }',
      '.text-amber-800 { color: #92400e; }',
      '@media print { body { padding: 0; } }',
    ].join('\n')

    printWindow.document.write(
      '<!DOCTYPE html><html><head><title>Comprovante de Pagamento</title><style>' +
      styles +
      '</style></head><body>' +
      content.innerHTML +
      '</body></html>'
    )
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const isFullyPaid = data.newRemaining <= 0.01

  return (
    <div className="flex flex-col max-h-[90vh]">
      {/* Receipt content */}
      <div className="flex-1 overflow-y-auto p-1">
        <div ref={receiptRef} className="bg-white text-black p-4 max-w-sm mx-auto" style={{ fontFamily: "'Courier New', monospace" }}>
          <div className="text-center mb-3">
            <p className="text-base font-bold">DANI COSMETICOS</p>
            <p className="text-xs text-gray-500 mt-1">COMPROVANTE DE PAGAMENTO</p>
            <p className="text-xs text-gray-400 mt-1">{formatDateTimeBR(new Date())}</p>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          <div className="mb-2">
            <span className="text-xs text-gray-500">Cliente:</span>
            <span className="text-sm font-bold ml-1">{data.clientName}</span>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-bold">Valor pago</span>
              <span className="font-bold text-lg">{formatCurrency(data.amountPaid)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Forma de pagamento</span>
              <span>{methodLabel}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Data</span>
              <span>{formatDate(paidAtDate)}</span>
            </div>
            {data.feePercent > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Taxa ({data.feePercent}%)</span>
                <span>{formatCurrency(data.feeAmount)}</span>
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          <p className="text-xs font-bold text-gray-500 mb-1">RESUMO DA CONTA</p>
          <div className="space-y-1">
            {data.totalInstallments > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Parcela</span>
                <span>{data.installmentNumber}a de {data.totalInstallments}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Total da conta</span>
              <span>{formatCurrency(data.saleTotal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Total pago (acumulado)</span>
              <span className="text-green-700">{formatCurrency(data.newPaid)}</span>
            </div>
            {!isFullyPaid && (
              <div className="flex justify-between text-sm font-bold mt-1">
                <span>Saldo restante</span>
                <span className="text-amber-700">{formatCurrency(data.newRemaining)}</span>
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-gray-400 my-3" />

          <div className="text-center">
            {isFullyPaid ? (
              <span className="inline-block bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded">
                CONTA QUITADA
              </span>
            ) : (
              <span className="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded">
                PAGAMENTO PARCIAL
              </span>
            )}
          </div>

          <div className="border-t border-dashed border-gray-400 my-3" />
          <p className="text-center text-xs text-gray-400">
            Obrigada pela preferencia!
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="border-t bg-background p-3 space-y-2 shrink-0">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="flex-1 gap-1.5">
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleCopy()}
            className="gap-1.5"
          >
            {copied ? (
              <><Check className="h-4 w-4 text-green-600" /> Copiado!</>
            ) : (
              <><Copy className="h-4 w-4" /> Copiar</>
            )}
          </Button>
        </div>
        <div className="flex gap-2">
          {data.clientPhone && formatWhatsAppUrl(data.clientPhone) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleWhatsApp}
              className="flex-1 gap-1.5 text-green-700 border-green-300 hover:bg-green-50 hover:text-green-800 hover:border-green-400"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar WhatsApp
            </Button>
          )}
          <Button size="sm" onClick={onClose} className="flex-1">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}
