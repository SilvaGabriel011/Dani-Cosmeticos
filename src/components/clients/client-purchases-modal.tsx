'use client'

import { ChevronDown, ChevronUp, Receipt, ShoppingBag } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useSales } from '@/hooks/use-sales'
import { formatCurrency } from '@/lib/utils'
import { type Sale } from '@/types'

interface ClientPurchasesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string | null
  clientName: string
}

export function ClientPurchasesModal({
  open,
  onOpenChange,
  clientId,
  clientName,
}: ClientPurchasesModalProps) {
  const { data, isLoading } = useSales(
    clientId ? { clientId, limit: 50 } : { limit: 0 }
  )
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null)

  const sales = (data?.data || []) as Sale[]

  const toggleExpand = (saleId: string) => {
    setExpandedSaleId((prev) => (prev === saleId ? null : saleId))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Compras de {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[65vh] overflow-y-auto">
          {isLoading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : sales.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Nenhuma compra encontrada.
            </p>
          ) : (
            sales.map((sale) => {
              const isExpanded = expandedSaleId === sale.id
              const statusLabel =
                sale.status === 'COMPLETED'
                  ? 'Pago'
                  : sale.status === 'PENDING'
                    ? 'Pendente'
                    : sale.status === 'CANCELLED'
                      ? 'Cancelado'
                      : sale.status
              const statusColor =
                sale.status === 'COMPLETED'
                  ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'
                  : sale.status === 'PENDING'
                    ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400'
                    : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'

              return (
                <div key={sale.id} className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => toggleExpand(sale.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {new Date(sale.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                        <Badge variant="secondary" className={`text-xs ${statusColor}`}>
                          {statusLabel}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {sale.items?.length || 0} {(sale.items?.length || 0) === 1 ? 'item' : 'itens'} — <span className="font-semibold text-foreground">{formatCurrency(Number(sale.total))}</span>
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && sale.items && sale.items.length > 0 && (
                    <div className="border-t bg-muted/30 px-3 py-2 space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-1">
                        <ShoppingBag className="h-3 w-3" />
                        Itens
                      </p>
                      {sale.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-sm py-1"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="font-medium truncate">
                              {item.product?.name || 'Produto'}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              {item.quantity}x {formatCurrency(Number(item.unitPrice))}
                            </span>
                          </div>
                          <span className="font-semibold shrink-0 ml-3">
                            {formatCurrency(Number(item.total))}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-1.5 border-t text-sm">
                        <span className="font-semibold">Total:</span>
                        <span className="font-bold">
                          {formatCurrency(Number(sale.total))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
