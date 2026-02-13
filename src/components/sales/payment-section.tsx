'use client'

import { Plus, Trash2, Wallet, Handshake } from 'lucide-react'
import { memo } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'

export interface Payment {
  method: 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT'
  amount: number
  feePercent: number
  feeAbsorber: 'SELLER' | 'CLIENT'
  installments: number
}

interface PaymentRowProps {
  payment: Payment
  index: number
  onUpdate: (index: number, updates: Partial<Payment>) => void
  onRemove: (index: number) => void
}

const PaymentRow = memo(function PaymentRow({
  payment,
  index,
  onUpdate,
  onRemove,
}: PaymentRowProps) {
  return (
    <div className="space-y-2 p-3 border rounded-md bg-background">
      <div className="flex gap-2">
        <Select
          value={payment.method}
          onValueChange={(v) => onUpdate(index, { method: v as Payment['method'] })}
        >
          <SelectTrigger className="flex-1">
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
        <Input
          type="number"
          min="0"
          step="0.01"
          value={payment.amount}
          onChange={(e) => onUpdate(index, { amount: Number(e.target.value) })}
          className="w-28"
        />
        <Button variant="ghost" size="icon" onClick={() => onRemove(index)}>
          <Trash2 className="h-5 w-5 text-destructive" />
        </Button>
      </div>
      {payment.method === 'CREDIT' && (
        <Select
          value={payment.installments.toString()}
          onValueChange={(v) => onUpdate(index, { installments: Number(v) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
              <SelectItem key={n} value={n.toString()}>
                {n}x {n === 1 ? 'à vista' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {payment.feePercent > 0 && (
        <p className="text-sm text-muted-foreground">Taxa: {payment.feePercent}%</p>
      )}
    </div>
  )
})

interface PaymentModeButtonProps {
  isActive: boolean
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}

const PaymentModeButton = memo(function PaymentModeButton({
  isActive,
  icon,
  title,
  description,
  onClick,
}: PaymentModeButtonProps) {
  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      className={`h-auto py-4 px-5 justify-start transition-all duration-200 ${
        isActive ? 'ring-2 ring-primary ring-offset-2' : 'hover:bg-primary/5'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className={`p-2.5 rounded-full ${isActive ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
          {icon}
        </div>
        <div className="flex-1 text-left">
          <div className="font-semibold text-base">{title}</div>
          <div className="text-sm opacity-70 font-normal">{description}</div>
        </div>
      </div>
    </Button>
  )
})

interface PaymentSectionProps {
  total: number
  isFiadoMode: boolean
  payments: Payment[]
  onSetFiadoMode: (mode: boolean) => void
  onAddPayment: () => void
  onUpdatePayment: (index: number, updates: Partial<Payment>) => void
  onRemovePayment: (index: number) => void
}

export function PaymentSection({
  total,
  isFiadoMode,
  payments,
  onSetFiadoMode,
  onAddPayment,
  onUpdatePayment,
  onRemovePayment,
}: PaymentSectionProps) {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-xl text-center border border-primary/20">
        <p className="text-sm text-muted-foreground font-medium">Total da compra</p>
        <p className="text-3xl font-bold text-primary mt-1">{formatCurrency(total)}</p>
      </div>

      <div className="grid gap-3">
        <PaymentModeButton
          isActive={!isFiadoMode}
          icon={<Wallet className="h-6 w-6" />}
          title="Pagar Agora"
          description="Dinheiro, PIX ou cartão"
          onClick={() => {
            onSetFiadoMode(false)
            if (payments.length === 0) {
              onAddPayment()
            }
          }}
        />

        <PaymentModeButton
          isActive={isFiadoMode}
          icon={<Handshake className="h-6 w-6" />}
          title="Fiado"
          description="Pagar depois em parcelas"
          onClick={() => onSetFiadoMode(true)}
        />
      </div>

      {!isFiadoMode && (
        <div className="bg-green-50/80 dark:bg-green-950/20 p-4 rounded-xl space-y-3 border border-green-200 dark:border-green-800">
          <p className="font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Forma de pagamento:
          </p>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onAddPayment}>
              <Plus className="h-5 w-5 mr-1" />
              Adicionar Pagamento
            </Button>
          </div>

          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              Nenhum pagamento adicionado
            </p>
          ) : (
            payments.map((payment, index) => (
              <PaymentRow
                key={index}
                payment={payment}
                index={index}
                onUpdate={onUpdatePayment}
                onRemove={onRemovePayment}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
