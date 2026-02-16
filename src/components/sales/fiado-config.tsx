'use client'

import { Handshake } from 'lucide-react'
import { memo } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'

interface FiadoConfigProps {
  total: number
  isInstallment: boolean
  paymentDay: number
  installmentPlan: number
  fixedInstallmentAmount: number | null
  onIsInstallmentChange: (value: boolean) => void
  onPaymentDayChange: (value: number) => void
  onInstallmentPlanChange: (value: number) => void
  onFixedInstallmentAmountChange: (value: number | null) => void
}

export const FiadoConfig = memo(function FiadoConfig({
  total,
  isInstallment,
  paymentDay,
  installmentPlan,
  fixedInstallmentAmount,
  onIsInstallmentChange,
  onPaymentDayChange,
  onInstallmentPlanChange,
  onFixedInstallmentAmountChange,
}: FiadoConfigProps) {
  const getPaymentDatesPreview = () => {
    const dates: Date[] = []
    const now = new Date()
    const day = paymentDay
    const monthOffset = now.getDate() >= day ? 1 : 0

    for (let i = 0; i < installmentPlan; i++) {
      let targetMonth = now.getMonth() + i + monthOffset
      let targetYear = now.getFullYear()

      while (targetMonth > 11) {
        targetMonth -= 12
        targetYear += 1
      }

      const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
      const date = new Date(targetYear, targetMonth, Math.min(day, lastDayOfMonth))
      dates.push(date)
    }
    return dates
  }

  return (
    <div className="bg-amber-50/80 dark:bg-amber-950/20 p-4 rounded-xl space-y-4 border border-amber-200 dark:border-amber-800">
      <div className="text-center">
        <p className="font-semibold text-amber-800 dark:text-amber-300 flex items-center justify-center gap-2">
          <Handshake className="h-5 w-5" />
          Como vai ser o fiado?
        </p>
        <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
          O valor total de <strong>{formatCurrency(total)}</strong> será registrado como fiado.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="installment-toggle-simple"
            checked={isInstallment}
            onChange={(e) => onIsInstallmentChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
          />
          <Label htmlFor="installment-toggle-simple" className="cursor-pointer">
            Dividir em parcelas mensais
          </Label>
        </div>

        {isInstallment && (
          <div className="space-y-3 pl-6 border-l-2 border-amber-200 dark:border-amber-800">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Número de parcelas</Label>
                <Select
                  value={installmentPlan.toString()}
                  onValueChange={(v) => onInstallmentPlanChange(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n}x
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Dia do pagamento</Label>
                <Select
                  value={paymentDay.toString()}
                  onValueChange={(v) => onPaymentDayChange(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={day.toString()}>
                        Dia {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">Valor fixo por parcela (opcional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={formatCurrency(total / installmentPlan)}
                value={fixedInstallmentAmount || ''}
                onChange={(e) => {
                  const value = e.target.value ? Number(e.target.value) : null
                  onFixedInstallmentAmountChange(value)
                }}
              />
              <p className="text-sm text-muted-foreground">
                Se não informado, será {formatCurrency(total / installmentPlan)} por parcela
              </p>
            </div>

            <div className="bg-background p-2 rounded border text-sm">
              <p className="font-medium mb-1">Previsão de pagamentos:</p>
              <div className="space-y-1">
                {getPaymentDatesPreview().map((date, i) => (
                  <div key={i} className="flex justify-between">
                    <span>Parcela {i + 1}:</span>
                    <span>{formatDate(date)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
