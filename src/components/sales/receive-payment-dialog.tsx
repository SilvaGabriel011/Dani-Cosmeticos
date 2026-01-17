"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useSettings } from "@/hooks/use-settings"
import { useAddPayment } from "@/hooks/use-sales"
import { Sale } from "@/types"
import { formatCurrency } from "@/lib/utils"
import { PAYMENT_METHOD_LABELS } from "@/lib/constants"

interface ReceivePaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sale: Sale | null
}

export function ReceivePaymentDialog({ open, onOpenChange, sale }: ReceivePaymentDialogProps) {
  const { toast } = useToast()
  const { data: settings } = useSettings()
  const addPayment = useAddPayment()

  const [method, setMethod] = useState<"CASH" | "PIX" | "DEBIT" | "CREDIT">("PIX")
  const [amount, setAmount] = useState(0)
  const [feePercent, setFeePercent] = useState(0)
  const [feeAbsorber, setFeeAbsorber] = useState<"SELLER" | "CLIENT">("SELLER")
  const [installments, setInstallments] = useState(1)

  if (!sale) return null

  const paidAmount = Number(sale.paidAmount || 0)
  const total = Number(sale.total)
  const remaining = total - paidAmount

  const handleMethodChange = (newMethod: "CASH" | "PIX" | "DEBIT" | "CREDIT") => {
    setMethod(newMethod)
    switch (newMethod) {
      case "DEBIT":
        setFeePercent(Number(settings?.debitFeePercent || 1.5))
        break
      case "CREDIT":
        setFeePercent(
          installments > 1
            ? Number(settings?.creditInstallmentFee || 4)
            : Number(settings?.creditFeePercent || 3)
        )
        break
      default:
        setFeePercent(0)
    }
  }

  const handleInstallmentsChange = (value: number) => {
    setInstallments(value)
    if (method === "CREDIT") {
      setFeePercent(
        value > 1
          ? Number(settings?.creditInstallmentFee || 4)
          : Number(settings?.creditFeePercent || 3)
      )
    }
  }

  const handleSubmit = async () => {
    if (amount <= 0) {
      toast({ title: "Informe um valor válido", variant: "destructive" })
      return
    }

    if (amount > remaining + 0.01) {
      toast({ 
        title: "Valor excede o saldo devedor", 
        description: `Máximo: ${formatCurrency(remaining)}`,
        variant: "destructive" 
      })
      return
    }

    try {
      await addPayment.mutateAsync({
        saleId: sale.id,
        data: {
          method,
          amount,
          feePercent,
          feeAbsorber,
          installments,
        },
      })

      const newRemaining = remaining - amount
      toast({ 
        title: "Pagamento registrado!",
        description: newRemaining <= 0.01 
          ? "Venda quitada!" 
          : `Saldo restante: ${formatCurrency(newRemaining)}`
      })

      setAmount(0)
      setMethod("PIX")
      setFeePercent(0)
      setInstallments(1)
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Erro ao registrar pagamento",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && sale) {
      setAmount(remaining)
      setMethod("PIX")
      setFeePercent(0)
      setFeeAbsorber(settings?.defaultFeeAbsorber || "SELLER")
      setInstallments(1)
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Receber Pagamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-muted p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Cliente:</span>
              <span className="font-medium">{sale.client?.name || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total da Venda:</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Já Pago:</span>
              <span className="text-green-600">{formatCurrency(paidAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Saldo Devedor:</span>
              <span className="text-amber-600">{formatCurrency(remaining)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <Select value={method} onValueChange={(v) => handleMethodChange(v as typeof method)}>
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
          </div>

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
                onClick={() => setAmount(Math.round(remaining / 2 * 100) / 100)}
              >
                Metade
              </Button>
            </div>
          </div>

          {method === "CREDIT" && (
            <div className="space-y-2">
              <Label>Parcelas</Label>
              <Select
                value={installments.toString()}
                onValueChange={(v) => handleInstallmentsChange(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n}x {n === 1 ? "à vista" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {feePercent > 0 && (
            <div className="space-y-2">
              <Label>Quem paga a taxa?</Label>
              <Select value={feeAbsorber} onValueChange={(v) => setFeeAbsorber(v as typeof feeAbsorber)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SELLER">Vendedor ({feePercent}%)</SelectItem>
                  <SelectItem value="CLIENT">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={addPayment.isPending}>
            {addPayment.isPending ? "Registrando..." : "Registrar Pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
