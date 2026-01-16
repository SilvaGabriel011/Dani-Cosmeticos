"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { useReceivablesByClient, usePayReceivable } from "@/hooks/use-receivables"
import { formatCurrency, formatDate } from "@/lib/utils"
import { DollarSign } from "lucide-react"

interface ClientReceivablesProps {
  clientId: string
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
  OVERDUE: "Vencido",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  PARTIAL: "secondary",
  PAID: "default",
  OVERDUE: "destructive",
}

export function ClientReceivables({ clientId }: ClientReceivablesProps) {
  const { toast } = useToast()
  const { data: receivables, isLoading } = useReceivablesByClient(clientId)
  const payReceivable = usePayReceivable()

  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean
    receivable: any | null
  }>({ open: false, receivable: null })
  const [paymentAmount, setPaymentAmount] = useState("")

  const handleOpenPayment = (receivable: any) => {
    const remaining = Number(receivable.amount) - Number(receivable.paidAmount)
    setPaymentAmount(String(remaining))
    setPaymentDialog({ open: true, receivable })
  }

  const handlePayment = async () => {
    if (!paymentDialog.receivable || !paymentAmount) return

    try {
      await payReceivable.mutateAsync({
        id: paymentDialog.receivable.id,
        amount: Number(paymentAmount),
      })
      toast({ title: "Pagamento registrado com sucesso!" })
      setPaymentDialog({ open: false, receivable: null })
      setPaymentAmount("")
    } catch (error: any) {
      toast({
        title: "Erro ao registrar pagamento",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contas a Receber</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px]" />
        </CardContent>
      </Card>
    )
  }

  const pendingReceivables = receivables?.filter(
    (r: any) => r.status !== "PAID"
  ) || []

  const totalPending = pendingReceivables.reduce(
    (sum: number, r: any) => sum + Number(r.amount) - Number(r.paidAmount),
    0
  )

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Contas a Receber</CardTitle>
            {totalPending > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Total pendente: <span className="font-semibold text-foreground">{formatCurrency(totalPending)}</span>
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!receivables?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma conta a receber para este cliente.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venda</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivables.map((receivable: any) => {
                  const remaining = Number(receivable.amount) - Number(receivable.paidAmount)
                  const isOverdue = new Date(receivable.dueDate) < new Date() && receivable.status !== "PAID"
                  const displayStatus = isOverdue && receivable.status !== "PAID" ? "OVERDUE" : receivable.status

                  return (
                    <TableRow key={receivable.id}>
                      <TableCell className="font-mono text-xs">
                        {receivable.saleId.slice(0, 8)}...
                      </TableCell>
                      <TableCell>{receivable.installment}x</TableCell>
                      <TableCell>
                        {formatDate(new Date(receivable.dueDate))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(receivable.amount))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(receivable.paidAmount))}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={STATUS_VARIANTS[displayStatus]}>
                          {STATUS_LABELS[displayStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {receivable.status !== "PAID" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenPayment(receivable)}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Pagar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={paymentDialog.open}
        onOpenChange={(open) => !open && setPaymentDialog({ open: false, receivable: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {paymentDialog.receivable && (
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Parcela:</span>{" "}
                  {paymentDialog.receivable.installment}x
                </p>
                <p>
                  <span className="text-muted-foreground">Valor da parcela:</span>{" "}
                  {formatCurrency(Number(paymentDialog.receivable.amount))}
                </p>
                <p>
                  <span className="text-muted-foreground">Já pago:</span>{" "}
                  {formatCurrency(Number(paymentDialog.receivable.paidAmount))}
                </p>
                <p>
                  <span className="text-muted-foreground">Restante:</span>{" "}
                  <span className="font-semibold">
                    {formatCurrency(
                      Number(paymentDialog.receivable.amount) -
                        Number(paymentDialog.receivable.paidAmount)
                    )}
                  </span>
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Valor do pagamento</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentDialog({ open: false, receivable: null })}
            >
              Cancelar
            </Button>
            <Button onClick={handlePayment} disabled={payReceivable.isPending}>
              {payReceivable.isPending ? "Registrando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
