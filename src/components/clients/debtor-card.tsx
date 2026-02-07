'use client'

import { ChevronDown, ChevronUp, Phone, MapPin, Package, MessageCircle, DollarSign, Eye } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PaymentHistoryDialog } from '@/components/clients/payment-history-dialog'
import { type Debtor } from '@/hooks/use-debtors'
import { formatCurrency, formatDate, formatWhatsAppUrl } from '@/lib/utils'

interface DebtorCardProps {
  debtor: Debtor
}

export function DebtorCard({ debtor }: DebtorCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)

  const monthlyExpected = debtor.sales.reduce((sum, sale) => {
    if (sale.fixedInstallmentAmount) return sum + Number(sale.fixedInstallmentAmount)
    const nextReceivable = sale.receivables.find((r) => r.status !== 'PAID')
    if (nextReceivable) return sum + (Number(nextReceivable.amount) - Number(nextReceivable.paidAmount))
    return sum
  }, 0)

  return (
    <Card className={debtor.isOverdue ? 'border-destructive/50' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{debtor.client.name}</h3>
              {debtor.isOverdue && (
                <Badge variant="destructive" className="text-sm">
                  Vencido
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone className="h-5 w-5" />
                {debtor.client.phone}
              </span>
              {debtor.client.phone && formatWhatsAppUrl(debtor.client.phone) && (
                <a
                  href={formatWhatsAppUrl(debtor.client.phone)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-green-600 hover:text-green-700 transition-colors"
                  title="Abrir WhatsApp"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>WhatsApp</span>
                </a>
              )}
              {debtor.client.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-5 w-5" />
                  {debtor.client.address}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Devido</p>
            <p className="text-xl font-bold">{formatCurrency(debtor.totalDebt)}</p>
            {debtor.overdueAmount > 0 && (
              <p className="text-sm text-destructive">
                Vencido: {formatCurrency(debtor.overdueAmount)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">
              {debtor.salesCount} {debtor.salesCount === 1 ? 'compra' : 'compras'} pendente
              {debtor.salesCount !== 1 ? 's' : ''}
            </span>
            {monthlyExpected > 0 && (
              <div className="flex items-center gap-1 text-sm font-medium text-amber-700">
                <DollarSign className="h-4 w-4" />
                Cobrar: {formatCurrency(monthlyExpected)}/mês
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPaymentHistory(true)}
              title="Histórico de pagamentos"
            >
              <Eye className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? (
                <>
                  <ChevronUp className="h-5 w-5 mr-1" />
                  Ocultar Detalhes
                </>
              ) : (
                <>
                  <ChevronDown className="h-5 w-5 mr-1" />
                  Ver Detalhes
                </>
              )}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 space-y-4 border-t pt-4">
            {debtor.sales.map((sale) => {
              const totalPaid = sale.receivables.reduce((sum, r) => sum + Number(r.paidAmount), 0)
              const _totalAmount = sale.receivables.reduce((sum, r) => sum + Number(r.amount), 0)
              const paidInstallments = sale.receivables.filter((r) => r.status === 'PAID').length

              return (
                <div key={sale.id} className="rounded-md bg-muted/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Compra {formatDate(sale.createdAt)}</span>
                      <span className="text-sm text-muted-foreground">
                        - {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                    <span className="font-medium">{formatCurrency(Number(sale.total))}</span>
                  </div>

                  <div className="pl-6 space-y-1">
                    {sale.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {item.product.name} ({item.quantity}x)
                        </span>
                        <span>{formatCurrency(Number(item.total))}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pl-6 pt-2 border-t border-muted space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Parcelas: {paidInstallments}/{sale.receivables.length} pagas
                      </span>
                      <span className="text-green-600">Pago: {formatCurrency(totalPaid)}</span>
                    </div>
                    {sale.fixedInstallmentAmount && (
                      <div className="flex items-center gap-1 text-sm font-medium text-amber-700">
                        <DollarSign className="h-3.5 w-3.5" />
                        Valor combinado: {formatCurrency(Number(sale.fixedInstallmentAmount))}/mês
                      </div>
                    )}
                    {sale.receivables
                      .filter((r) => r.status !== 'PAID')
                      .slice(0, 1)
                      .map((r) => {
                        const isOverdue = new Date(r.dueDate) < new Date()
                        const remaining = Number(r.amount) - Number(r.paidAmount)
                        const expectedAmount = sale.fixedInstallmentAmount
                          ? Number(sale.fixedInstallmentAmount)
                          : null
                        const paidLessThanExpected =
                          expectedAmount && Number(r.paidAmount) > 0 && remaining > expectedAmount
                        return (
                          <div
                            key={r.id}
                            className={`text-sm ${isOverdue ? 'text-destructive' : ''}`}
                          >
                            Próx: {formatDate(r.dueDate)} — restam {formatCurrency(remaining)}
                            {isOverdue && ' - VENCIDO'}
                            {paidLessThanExpected && (
                              <span className="text-amber-600 ml-1">
                                (acumulado)
                              </span>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <PaymentHistoryDialog
        clientId={debtor.client.id}
        clientName={debtor.client.name}
        open={showPaymentHistory}
        onOpenChange={setShowPaymentHistory}
      />
    </Card>
  )
}
