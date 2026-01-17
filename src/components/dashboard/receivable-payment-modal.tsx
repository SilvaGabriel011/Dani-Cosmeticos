"use client"

import { useState, useEffect } from "react"
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
import { usePaySaleReceivables } from "@/hooks/use-receivables"
import { formatCurrency } from "@/lib/utils"
import { PAYMENT_METHOD_LABELS } from "@/lib/constants"
import { Receivable, Sale, Client } from "@prisma/client"

type ReceivableWithSale = Receivable & {
  sale: Sale & { client: Client | null }
}

interface ReceivablePaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  receivable: ReceivableWithSale | null
}

export function ReceivablePaymentModal({ 
  open, 
  onOpenChange, 
  receivable 
}: ReceivablePaymentModalProps) {
  const { toast } = useToast()
  const paySaleReceivables = usePaySaleReceivables()

  const [amount, setAmount] = useState(0)
  const [paidAt, setPaidAt] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "PIX" | "DEBIT" | "CREDIT">("PIX")

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
        setPaymentMethod("PIX")
      }
    }, [open, receivable])

  if (!receivable) return null

  const remaining = Number(receivable.amount) - Number(receivable.paidAmount)
  const clientName = receivable.sale?.client?.name || "Cliente nao informado"

  const handleSubmit = async () => {
    if (amount <= 0) {
      toast({ title: "Informe um valor valido", variant: "destructive" })
      return
    }

    try {
      await paySaleReceivables.mutateAsync({
        saleId: receivable.saleId,
        amount,
        paymentMethod,
        paidAt: paidAt ? new Date(paidAt).toISOString() : undefined,
      })

      toast({ 
        title: "Pagamento registrado!",
        description: "O pagamento foi distribuido entre as parcelas pendentes."
      })

      onOpenChange(false)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
      toast({
        title: "Erro ao registrar pagamento",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Adicionar Pagamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
              <span className="text-green-600">{formatCurrency(Number(receivable.paidAmount))}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Saldo Restante:</span>
              <span className="text-amber-600">{formatCurrency(remaining)}</span>
            </div>
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

          <div className="space-y-2">
            <Label>Data do Pagamento</Label>
            <Input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={paySaleReceivables.isPending}>
            {paySaleReceivables.isPending ? "Registrando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
