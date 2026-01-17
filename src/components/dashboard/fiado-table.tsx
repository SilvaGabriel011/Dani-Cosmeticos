"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useReceivables } from "@/hooks/use-receivables"
import { ReceivablePaymentModal } from "./receivable-payment-modal"
import { formatCurrency, formatDate } from "@/lib/utils"
import { CreditCard, Plus } from "lucide-react"
import { Receivable, Sale, Client } from "@prisma/client"

type ReceivableWithSale = Receivable & {
  sale: Sale & { client: Client | null }
}

interface SaleReceivableSummary {
  saleId: string
  clientName: string
  totalInstallments: number
  paidInstallments: number
  totalAmount: number
  paidAmount: number
  nextDueDate: Date | null
  nextReceivable: ReceivableWithSale | null
  isOverdue: boolean
}

export function FiadoTable() {
  const { data: receivablesData, isLoading } = useReceivables({ 
    status: "PENDING",
    limit: 100 
  })
  
  const [selectedReceivable, setSelectedReceivable] = useState<ReceivableWithSale | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)

  // Group receivables by sale and calculate summary
  const saleSummaries = useMemo(() => {
    if (!receivablesData) return []

    const receivables = receivablesData as ReceivableWithSale[]
    const salesMap = new Map<string, SaleReceivableSummary>()
    const now = new Date()

    receivables.forEach((receivable) => {
      const saleId = receivable.saleId
      const existing = salesMap.get(saleId)

      if (!existing) {
        // Get all receivables for this sale to calculate totals
        const saleReceivables = receivables.filter(r => r.saleId === saleId)
        const totalInstallments = Math.max(...saleReceivables.map(r => r.installment), 0)
        const paidInstallments = saleReceivables.filter(r => r.status === "PAID").length
        const totalAmount = saleReceivables.reduce((sum, r) => sum + Number(r.amount), 0)
        const paidAmount = saleReceivables.reduce((sum, r) => sum + Number(r.paidAmount), 0)
        
        // Find next unpaid receivable (earliest due date among pending/partial)
        const pendingReceivables = saleReceivables
          .filter(r => r.status === "PENDING" || r.status === "PARTIAL")
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        
        const nextReceivable = pendingReceivables[0] || null
        const nextDueDate = nextReceivable ? new Date(nextReceivable.dueDate) : null
        const isOverdue = nextDueDate ? nextDueDate < now : false

        salesMap.set(saleId, {
          saleId,
          clientName: receivable.sale?.client?.name || "Cliente nao informado",
          totalInstallments,
          paidInstallments,
          totalAmount,
          paidAmount,
          nextDueDate,
          nextReceivable,
          isOverdue,
        })
      }
    })

    // Sort by next due date (overdue first, then by date)
    return Array.from(salesMap.values()).sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1
      if (!a.isOverdue && b.isOverdue) return 1
      if (!a.nextDueDate) return 1
      if (!b.nextDueDate) return -1
      return a.nextDueDate.getTime() - b.nextDueDate.getTime()
    })
  }, [receivablesData])

  const handleAddPayment = (summary: SaleReceivableSummary) => {
    if (summary.nextReceivable) {
      setSelectedReceivable(summary.nextReceivable)
      setPaymentModalOpen(true)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-500" />
            Vendas Fiado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px]" />
        </CardContent>
      </Card>
    )
  }

  if (saleSummaries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-500" />
            Vendas Fiado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma venda fiado pendente.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-500" />
            Vendas Fiado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Parcelas</TableHead>
                  <TableHead className="text-right">Valor Pago</TableHead>
                  <TableHead className="text-right">Valor Restante</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Prox. Pagamento</TableHead>
                  <TableHead className="text-center">Acao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saleSummaries.map((summary) => (
                  <TableRow key={summary.saleId}>
                    <TableCell className="font-medium">
                      {summary.clientName}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono">
                        {summary.paidInstallments}/{summary.totalInstallments}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(summary.paidAmount)}
                    </TableCell>
                    <TableCell className="text-right text-amber-600">
                      {formatCurrency(summary.totalAmount - summary.paidAmount)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(summary.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <div className="w-20">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${Math.min((summary.paidAmount / summary.totalAmount) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {Math.round((summary.paidAmount / summary.totalAmount) * 100)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {summary.nextDueDate ? (
                        <div className="flex items-center gap-2">
                          <span className={summary.isOverdue ? "text-destructive" : ""}>
                            {formatDate(summary.nextDueDate)}
                          </span>
                          {summary.isOverdue && (
                            <Badge variant="destructive" className="text-xs">
                              Vencido
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddPayment(summary)}
                        disabled={!summary.nextReceivable}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Pagamento
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ReceivablePaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        receivable={selectedReceivable}
      />
    </>
  )
}
