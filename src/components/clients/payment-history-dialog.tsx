'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { useClientPaymentHistory, useDeletePayment, useEditPayment, type ClientPayment } from '@/hooks/use-payments'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'

interface PaymentHistoryDialogProps {
  clientId: string
  clientName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PaymentHistoryDialog({
  clientId,
  clientName,
  open,
  onOpenChange,
}: PaymentHistoryDialogProps) {
  const { data: payments, isLoading } = useClientPaymentHistory(clientId, open)
  const { toast } = useToast()
  const deletePaymentMut = useDeletePayment()
  const editPaymentMut = useEditPayment()

  const [deleteTarget, setDeleteTarget] = useState<ClientPayment | null>(null)
  const [editTarget, setEditTarget] = useState<ClientPayment | null>(null)
  const [editAmount, setEditAmount] = useState(0)
  const [editMethod, setEditMethod] = useState<string>('PIX')
  const [editPaidAt, setEditPaidAt] = useState('')

  const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Histórico de Pagamentos — {clientName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !payments?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum pagamento registrado para este cliente.
          </p>
        ) : (
          <div className="overflow-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Venda</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(new Date(payment.paidAt))}</TableCell>
                    <TableCell>
                      {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(payment.amount))}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(new Date(payment.sale.createdAt))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditTarget(payment)
                            setEditAmount(Number(payment.amount))
                            setEditMethod(payment.method)
                            setEditPaidAt(new Date(payment.paidAt).toISOString().split('T')[0])
                          }}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(payment)}
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="border-t pt-3 mt-2 flex justify-between items-center px-1">
              <span className="text-sm text-muted-foreground">
                {payments.length} pagamento{payments.length !== 1 ? 's' : ''}
              </span>
              <span className="font-semibold">
                Total: {formatCurrency(totalPaid)}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Delete confirmation */}
    <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir pagamento?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteTarget && (
              <>Excluir pagamento de <strong>{formatCurrency(Number(deleteTarget.amount))}</strong>? As parcelas serão recalculadas.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deletePaymentMut.isPending}
            onClick={async () => {
              if (!deleteTarget) return
              try {
                await deletePaymentMut.mutateAsync(deleteTarget.id)
                toast({ title: 'Pagamento excluído', description: 'Parcelas recalculadas.' })
                setDeleteTarget(null)
              } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Erro desconhecido'
                toast({ title: 'Erro ao excluir', description: msg, variant: 'destructive' })
              }
            }}
          >
            {deletePaymentMut.isPending ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Edit dialog */}
    <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }}>
      <DialogContent className="max-w-[95vw] md:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Valor</Label>
            <Input type="number" min="0.01" step="0.01" value={editAmount} onChange={(e) => setEditAmount(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <Select value={editMethod} onValueChange={setEditMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data do Pagamento</Label>
            <Input type="date" value={editPaidAt} onChange={(e) => setEditPaidAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
          <Button
            disabled={editPaymentMut.isPending || editAmount <= 0}
            onClick={async () => {
              if (!editTarget) return
              try {
                await editPaymentMut.mutateAsync({
                  id: editTarget.id,
                  data: {
                    amount: editAmount,
                    method: editMethod,
                    paidAt: editPaidAt ? new Date(editPaidAt + 'T12:00:00').toISOString() : undefined,
                  },
                })
                toast({ title: 'Pagamento atualizado', description: 'Parcelas recalculadas.' })
                setEditTarget(null)
              } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Erro desconhecido'
                toast({ title: 'Erro ao editar', description: msg, variant: 'destructive' })
              }
            }}
          >
            {editPaymentMut.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
