'use client'

import { AlertTriangle } from 'lucide-react'
import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { useOverrideReceivable } from '@/hooks/use-receivables'

interface ReceivableOverrideDialogProps {
  receivable: {
    id: string
    installment: number
    amount: unknown
    paidAmount: unknown
    status: string
    dueDate: string | Date
    sale?: {
      id: string
      total: unknown
      client?: { id: string; name: string } | null
    }
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReceivableOverrideDialog({
  receivable,
  open,
  onOpenChange,
}: ReceivableOverrideDialogProps) {
  const { toast } = useToast()
  const overrideMutation = useOverrideReceivable()

  const [amount, setAmount] = useState(Number(receivable.amount))
  const [paidAmount, setPaidAmount] = useState(Number(receivable.paidAmount))
  const [status, setStatus] = useState(receivable.status)
  const [dueDate, setDueDate] = useState(
    new Date(receivable.dueDate).toISOString().split('T')[0]
  )
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) {
      setAmount(Number(receivable.amount))
      setPaidAmount(Number(receivable.paidAmount))
      setStatus(receivable.status)
      setDueDate(new Date(receivable.dueDate).toISOString().split('T')[0])
      setReason('')
    }
  }, [open, receivable])

  const statusOptions = [
    { value: 'PENDING', label: 'Pendente' },
    { value: 'PARTIAL', label: 'Parcial' },
    { value: 'PAID', label: 'Paga' },
    { value: 'OVERDUE', label: 'Atrasada' },
    { value: 'CANCELLED', label: 'Cancelada' },
  ]

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo da alteração.',
        variant: 'destructive',
      })
      return
    }

    try {
      await overrideMutation.mutateAsync({
        id: receivable.id,
        data: {
          amount,
          paidAmount,
          status,
          dueDate: dueDate + 'T12:00:00.000Z',
          reason,
        },
      })

      toast({
        title: 'Parcela atualizada',
        description: `Parcela #${receivable.installment} foi corrigida com sucesso.`,
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Editar Parcela #{receivable.installment}
          </DialogTitle>
          <DialogDescription>
            Venda #{receivable.sale?.id.slice(0, 8)} •{' '}
            {receivable.sale?.client?.name || 'Sem cliente'}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800">
          <p className="text-xs">
            Alterações aqui sobrescrevem o valor diretamente. A venda será recalculada
            automaticamente.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount-input" className="text-sm">
                Valor da Parcela (R$)
              </Label>
              <Input
                id="amount-input"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="paid-amount-input" className="text-sm">
                Valor Pago (R$)
              </Label>
              <Input
                id="paid-amount-input"
                type="number"
                step="0.01"
                min="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="status-select" className="text-sm">
                Status
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="due-date-input" className="text-sm">
                Vencimento
              </Label>
              <Input
                id="due-date-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason-textarea" className="text-sm font-semibold text-amber-700 dark:text-amber-200">
              Motivo da alteração *
            </Label>
            <Textarea
              id="reason-textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo da correção..."
              className="border-amber-300 focus:border-amber-500 dark:border-amber-800 dark:focus:border-amber-600"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={overrideMutation.isPending || !reason.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-700 dark:hover:bg-amber-600"
          >
            {overrideMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
