'use client'

import { AlertTriangle, ChevronDown, ChevronUp, History, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

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
import { useOverrideSale } from '@/hooks/use-sales'
import { formatCurrency, formatDate } from '@/lib/utils'

// Types
interface OverrideLog {
  id: string
  reason: string
  changes: Record<string, unknown>
  createdAt: string
}

interface ReceivableEdit {
  id?: string
  installment: number
  amount: number
  paidAmount: number
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  dueDate: string
  _isNew?: boolean
  _toDelete?: boolean
}

interface SaleOverrideDialogProps {
  sale: {
    id: string
    status: string
    total: unknown
    paidAmount: unknown
    discountPercent: unknown
    notes?: string | null
    subtotal: unknown
    totalFees: unknown
    receivables: Array<{
      id: string
      installment: number
      amount: unknown
      paidAmount: unknown
      status: string
      dueDate: string | Date
    }>
    client?: { id: string; name: string } | null
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SaleOverrideDialog({ sale, open, onOpenChange }: SaleOverrideDialogProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const overrideMutation = useOverrideSale()

  // Sale-level fields
  const [status, setStatus] = useState(sale.status as 'COMPLETED' | 'PENDING')
  const [paidAmount, setPaidAmount] = useState(Number(sale.paidAmount))
  const [discountPercent, setDiscountPercent] = useState(Number(sale.discountPercent))
  const [notes, setNotes] = useState(sale.notes || '')
  const [reason, setReason] = useState('')

  // Receivables
  const [receivables, setReceivables] = useState<ReceivableEdit[]>([])
  const [deleteIds, setDeleteIds] = useState<string[]>([])

  // History
  const [showHistory, setShowHistory] = useState(false)

  // Fetch history
  const { data: history, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['override-history', sale.id],
    queryFn: async () => {
      const res = await fetch(`/api/sales/${sale.id}/override-history`)
      if (!res.ok) throw new Error('Erro ao carregar histórico')
      return res.json() as Promise<OverrideLog[]>
    },
    enabled: open && showHistory,
  })

  // Revert mutation
  const revertMutation = useMutation({
    mutationFn: async (logId: string) => {
      const res = await fetch(`/api/sales/${sale.id}/override-history/${logId}/revert`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || 'Erro ao reverter')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: 'Venda revertida',
        description: 'A venda foi restaurada ao estado anterior.',
      })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['sale'] })
      queryClient.invalidateQueries({ queryKey: ['override-history', sale.id] })
      onOpenChange(false)
    },
    onError: (error) => {
      toast({
        title: 'Erro ao reverter',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    },
  })

  // Reset state when sale changes or dialog opens
  useEffect(() => {
    if (open) {
      setStatus(sale.status as 'COMPLETED' | 'PENDING')
      setPaidAmount(Number(sale.paidAmount))
      setDiscountPercent(Number(sale.discountPercent))
      setNotes(sale.notes || '')
      setReason('')
      setDeleteIds([])
      setShowHistory(false)
      setReceivables(
        sale.receivables.map((r) => ({
          id: r.id,
          installment: r.installment,
          amount: Number(r.amount),
          paidAmount: Number(r.paidAmount),
          status: r.status as ReceivableEdit['status'],
          dueDate: new Date(r.dueDate).toISOString().split('T')[0],
        }))
      )
    }
  }, [open, sale])

  const handleReceivableChange = (index: number, field: keyof ReceivableEdit, value: unknown) => {
    setReceivables((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleDeleteReceivable = (index: number) => {
    const rec = receivables[index]
    if (rec.id && !rec._isNew) {
      setDeleteIds((prev) => [...prev, rec.id!])
    }
    setReceivables((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddReceivable = () => {
    const maxInstallment = receivables.length > 0
      ? Math.max(...receivables.map((r) => r.installment))
      : 0
    const lastDueDate = receivables.length > 0
      ? new Date(receivables[receivables.length - 1].dueDate)
      : new Date()
    const nextDueDate = new Date(lastDueDate)
    nextDueDate.setMonth(nextDueDate.getMonth() + 1)

    setReceivables((prev) => [
      ...prev,
      {
        installment: maxInstallment + 1,
        amount: 0,
        paidAmount: 0,
        status: 'PENDING',
        dueDate: nextDueDate.toISOString().split('T')[0],
        _isNew: true,
      },
    ])
  }

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
        saleId: sale.id,
        data: {
          status,
          paidAmount,
          discountPercent,
          notes,
          reason,
          receivables: receivables.map((r) => ({
            ...(r.id && !r._isNew ? { id: r.id } : {}),
            installment: r.installment,
            amount: r.amount,
            paidAmount: r.paidAmount,
            status: r.status,
            dueDate: r.dueDate.includes('T') ? r.dueDate : r.dueDate + 'T12:00:00.000Z',
          })),
          deleteReceivableIds: deleteIds,
        },
      })

      toast({
        title: 'Venda atualizada',
        description: 'As alterações foram salvas com sucesso.',
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

  const statusOptions = [
    { value: 'PENDING', label: 'Pendente (Fiado)' },
    { value: 'COMPLETED', label: 'Concluída' },
  ]

  const receivableStatusOptions = [
    { value: 'PENDING', label: 'Pendente' },
    { value: 'PARTIAL', label: 'Parcial' },
    { value: 'PAID', label: 'Paga' },
    { value: 'OVERDUE', label: 'Atrasada' },
    { value: 'CANCELLED', label: 'Cancelada' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-xl lg:max-w-3xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Super Edição — Venda #{sale.id.slice(0, 8)}
          </DialogTitle>
          <DialogDescription>
            {sale.client?.name || 'Sem cliente'} • Total: {formatCurrency(Number(sale.total))}
          </DialogDescription>
        </DialogHeader>

        {/* Warning Banner */}
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Atenção: Super Edição
          </div>
          <p className="mt-1 text-xs">
            Alterações aqui sobrescrevem os valores diretamente no banco de dados, ignorando
            validações normais. Use com cuidado e sempre informe o motivo.
          </p>
        </div>

        {/* Sale-level fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status-select">Status da Venda</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'COMPLETED' | 'PENDING')}>
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

          <div className="space-y-2">
            <Label htmlFor="paid-amount-input">Valor Pago (R$)</Label>
            <Input
              id="paid-amount-input"
              type="number"
              step="0.01"
              min="0"
              value={paidAmount}
              onChange={(e) => setPaidAmount(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount-percent-input">Desconto (%)</Label>
            <Input
              id="discount-percent-input"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes-input">Observações</Label>
            <Input
              id="notes-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas sobre a venda..."
            />
          </div>
        </div>

        {/* Receivables Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Parcelas</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddReceivable}
              className="gap-1"
            >
              <Plus className="h-3 w-3" />
              Adicionar Parcela
            </Button>
          </div>

          {receivables.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma parcela. Clique em &quot;Adicionar Parcela&quot; para criar.
            </p>
          ) : (
            <div className="space-y-3">
              {receivables.map((rec, index) => (
                <div
                  key={rec.id || `new-${index}`}
                  className={`rounded-lg border p-3 space-y-3 ${
                    rec._isNew ? 'border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">
                      Parcela #{rec.installment}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => handleDeleteReceivable(index)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Remover
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">#</Label>
                      <Input
                        type="number"
                        min="1"
                        value={rec.installment}
                        onChange={(e) =>
                          handleReceivableChange(index, 'installment', Number(e.target.value))
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={rec.amount}
                        onChange={(e) =>
                          handleReceivableChange(index, 'amount', Number(e.target.value))
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Pago (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={rec.paidAmount}
                        onChange={(e) =>
                          handleReceivableChange(index, 'paidAmount', Number(e.target.value))
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Select
                        value={rec.status}
                        onValueChange={(v) => handleReceivableChange(index, 'status', v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {receivableStatusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Vencimento</Label>
                    <Input
                      type="date"
                      value={rec.dueDate}
                      onChange={(e) =>
                        handleReceivableChange(index, 'dueDate', e.target.value)
                      }
                      className="h-9 w-full sm:w-auto"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reason field */}
        <div className="space-y-2">
          <Label htmlFor="reason-textarea" className="text-sm font-semibold text-amber-700 dark:text-amber-200">
            Motivo da alteração *
          </Label>
          <Textarea
            id="reason-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Descreva o motivo da correção (ex: parcela estava duplicada, valor incorreto, etc.)"
            className="border-amber-300 focus:border-amber-500 dark:border-amber-800 dark:focus:border-amber-600"
            rows={2}
          />
        </div>

        {/* History section */}
        <div className="border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() => {
              setShowHistory(!showHistory)
              if (!showHistory) refetchHistory()
            }}
          >
            <History className="h-4 w-4" />
            Histórico de Alterações
            {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {showHistory && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {historyLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando histórico...
                </div>
              )}

              {history && history.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  Nenhuma alteração anterior registrada.
                </p>
              )}

              {history && history.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{log.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(log.createdAt)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-7 text-xs gap-1"
                    onClick={() => revertMutation.mutate(log.id)}
                    disabled={revertMutation.isPending}
                  >
                    {revertMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <RotateCcw className="h-3 w-3" />
                        Reverter
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
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
            {overrideMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
