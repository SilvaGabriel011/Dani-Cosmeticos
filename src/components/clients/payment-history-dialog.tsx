'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useClientPaymentHistory } from '@/hooks/use-payments'
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

  const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0

  return (
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
  )
}
